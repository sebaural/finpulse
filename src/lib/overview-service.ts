import { fetchWorldNewsFeeds, clusterAndWeight, isGeopoliticsRelevant, StoryCluster } from './overview-ingest';
import { generateWithRunpod, RUNPOD_MODEL } from './runpod';
import { getPrisma } from './db';
import { formatDateSegment } from './seo';
import slugify from 'slugify';
import { Client } from '@upstash/qstash';
import { z } from 'zod';

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

const OverviewLlmOutputSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  body: z.string().min(1),
});

// Extracts the first {...} JSON object from a string, tolerating preamble/fences
//
// NOTE: since the system prompt now requires "body" to contain an HTML
// fragment, the model has to correctly escape any quotes inside HTML
// attributes (e.g. an <a href="..."> in body text) as \" for the overall
// JSON to remain valid. extractJson/JSON.parse below handle standard
// escaped JSON fine — the risk is entirely on the model's output discipline,
// not this parsing logic. If parse failures start showing up in
// [overview/process] logs, check whether they correlate with HTML
// attributes in the failed body content before assuming extractJson itself
// is at fault.
function extractJson(raw: string): string {
  const fenceStripped = raw.replace(/```json\n?|\n?```/g, '').trim();
  const start = fenceStripped.indexOf('{');
  const end = fenceStripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('No JSON object found in model output');
  }
  return fenceStripped.slice(start, end + 1);
}

// Called by /api/overview/generate — picks the day's clusters
export async function selectDailyClusters(): Promise<StoryCluster[]> {
  const rawStories = await fetchWorldNewsFeeds();
  const weighted = clusterAndWeight(rawStories);

  const geopoliticsOnly = weighted.filter((c) =>
    c.members.some((m) => isGeopoliticsRelevant(m))
  );

  const ordered = geopoliticsOnly.sort((a, b) => {
    const rank = { high: 1, low: 0 };
    return rank[b.priority] - rank[a.priority];
  });

  return ordered.slice(0, 8);
}

// Called by /api/overview/generate — fans clusters out to QStash, one job each
export async function enqueueDailyClusters() {
  const clusters = await selectDailyClusters();
  // VERCEL_URL is injected automatically by the Vercel platform on every
  // deployment (production and preview) — it is NOT something you set
  // yourself, and it holds the domain WITHOUT a protocol prefix (e.g.
  // "my-app-git-main-team.vercel.app"), hence the manual `https://` below.
  // It is only present when code is actually running on Vercel.
  //
  // SITE_URL is the opposite: a custom env var YOU define (see Step 11),
  // used as the fallback whenever VERCEL_URL doesn't exist — most commonly
  // local development (`npm run dev`), where there's no Vercel deployment
  // to inject a URL from.
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.SITE_URL;

  console.log('[overview/generate] clusters.length', clusters.length);
  console.log('[overview/generate] base', base);
  console.log('[overview/generate] publishing to', `${base}/api/overview/process`);

  // The target URL is the deployment's own VERCEL_URL, which sits behind
  // Vercel's Deployment Protection (Vercel Authentication) — QStash has no
  // Vercel session to pass that wall with, so its callback gets redirected
  // into vercel.com/login and processCluster() never runs. The Protection
  // Bypass for Automation secret (Project Settings -> Deployment Protection)
  // lets QStash's webhook through without disabling protection entirely.
  const results = await Promise.allSettled(
    clusters.map((cluster) =>
      qstash.publishJSON({
        url: `${base}/api/overview/process`,
        body: { cluster },
        headers: { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET! },
      })
    )
  );

  let enqueued = 0;
  let failed = 0;
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      enqueued++;
    } else {
      failed++;
      console.error(
        `[overview/generate] enqueue failed for cluster "${clusters[i].representative.title}":`,
        result.reason
      );
    }
  });

  return { enqueued, failed };
}

// Called by /api/overview/process — handles exactly ONE cluster per invocation,
// so each call stays well within maxDuration = 60 regardless of RunPod's
// MAX_CONCURRENCY=2 limit or overall batch size.
// RSS titles/snippets are third-party content — strip stray markup before
// it's interpolated into the LLM prompt. Defense-in-depth alongside the
// output-side sanitization in the page (sanitizeArticleHtml): even though
// the model is instructed not to echo raw HTML, nothing prevents a feed
// item from containing it in the first place.
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

export async function processCluster(cluster: StoryCluster) {
  const prisma = getPrisma();

  // Lead with the representative source (preferred BBC/NYT phrasing, see
  // overview-ingest.ts) so the model anchors on the clearest account of the
  // story first; remaining members follow for corroborating detail.
  const orderedMembers = [
    cluster.representative,
    ...cluster.members.filter((m) => m !== cluster.representative),
  ];

  const sourceText = orderedMembers
    .map((m) => `- [${m.source}] ${stripHtml(m.title)}: ${stripHtml(m.snippet)}`)
    .join('\n');

  const messages = [
  {
    role: 'system',
    content:
      'You are a neutral geopolitics news editor. Write a factual, attributed summary ' +
      'article from the provided source snippets. Respond ONLY with raw JSON format (no markdown fences): ' +
      '{"title": "...", "summary": "...", "body": "..."}. Attribute claims to sources by name. ' +
      'The value of "body" must be an HTML fragment only. Do not use asterisks, markdown ' +
      'bold, markdown bullets, or any XML-style wrapper tags.',
  },
  { role: 'user', content: sourceText },
  ];

  const choiceContent = await generateWithRunpod(messages);

  const cleanJson = extractJson(choiceContent);
  const parsed = OverviewLlmOutputSchema.parse(JSON.parse(cleanJson));

  let slug = slugify(parsed.title, { lower: true, strict: true });

  // Collision guard: if a different article already holds this slug,
  // disambiguate rather than silently overwriting it.
  //
  // Same-day re-runs (idempotent cron retries) still upsert cleanly onto the
  // same row. But if the existing row was published on an earlier calendar
  // day, this is a genuine headline recurrence (e.g. a slow-moving story),
  // not a retry — suffix with today's date segment so the older day's
  // article isn't silently overwritten and its publishedDate isn't
  // misrepresented under new content.
  const existing = await prisma.overviewArticle.findUnique({ where: { slug } });
  const todaySegment = formatDateSegment(new Date());
  if (existing && formatDateSegment(existing.publishedDate) !== todaySegment) {
    slug = `${slug}-${todaySegment}`;
    // Residual edge case: the date-suffixed slug itself collides with an
    // unrelated article (e.g. slugify producing the same base title twice
    // in one day under different clusters) — fall back to an id suffix.
    const dateCollision = await prisma.overviewArticle.findUnique({ where: { slug } });
    if (dateCollision && dateCollision.title !== parsed.title) {
      slug = `${slug}-${dateCollision.id.slice(-6)}`;
    }
  } else if (existing && existing.title !== parsed.title) {
    slug = `${slug}-${existing.id.slice(-6)}`;
  }

  await prisma.overviewArticle.upsert({
    where: { slug },
    update: {
      title: parsed.title,
      summary: parsed.summary,
      body: parsed.body,
      model: RUNPOD_MODEL,
    },
    create: {
      slug,
      title: parsed.title,
      summary: parsed.summary,
      body: parsed.body,
      category: 'daily-overview',
      model: RUNPOD_MODEL,
    },
  });
}


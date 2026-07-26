import { fetchWorldNewsFeeds, clusterAndWeight, isGeopoliticsRelevant, StoryCluster } from './overview-ingest';
import { generateWithRunpod } from './runpod';
import { db } from './db'; // Adjust to export name in src/lib/db.ts
import slugify from 'slugify';
import { Client } from '@upstash/qstash';

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

// Extracts the first {...} JSON object from a string, tolerating preamble/fences
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
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.SITE_URL;

  await Promise.allSettled(
    clusters.map((cluster) =>
      qstash.publishJSON({
        url: `${base}/api/overview/process`,
        body: { cluster },
      })
    )
  );

  return { enqueued: clusters.length };
}

// Called by /api/overview/process — handles exactly ONE cluster per invocation,
// so each call stays well within maxDuration = 60 regardless of RunPod's
// MAX_CONCURRENCY=2 limit or overall batch size.
export async function processCluster(cluster: StoryCluster) {
  const sourceText = cluster.members
    .map((m) => `- [${m.source}] ${m.title}: ${m.snippet}`)
    .join('\n');

  const messages = [
  {
    role: 'system',
    content:
      'You are a neutral geopolitics news editor. Write a factual, attributed summary ' +
      'article from the provided source snippets. Respond ONLY with raw JSON format (no markdown fences): ' +
      '{"title": "...", "summary": "...", "body": "HTML fragment only. Do not use *, **, markdown bold, ' +
      'asterisks, bullets, or XML-style wrappers. Use semantic HTML and make titles a separate <h2> element. ' +
      'Keep the text beneath each heading in <p> blocks."}.',
  },
  { role: 'user', content: sourceText },
];

  const output = await generateWithRunpod(messages);
  const choiceContent = output?.choices?.[0]?.message?.content ?? output?.output;
  if (!choiceContent) throw new Error('Invalid output structure from RunPod');

  const cleanJson = extractJson(choiceContent);
  const parsed = JSON.parse(cleanJson);

  let slug = slugify(parsed.title, { lower: true, strict: true });

  // Collision guard: if a different article already holds this slug, disambiguate
  // rather than silently overwriting it. Same-title/same-story re-runs still upsert
  // cleanly onto the same row.
  const existing = await db.overviewArticle.findUnique({ where: { slug } });
  if (existing && existing.title !== parsed.title) {
    slug = `${slug}-${existing.id.slice(-6)}`;
  }

  await db.overviewArticle.upsert({
    where: { slug },
    update: {
      title: parsed.title,
      summary: parsed.summary,
      body: parsed.body,
      sourceUrls: cluster.members.map((m) => m.url),
    },
    create: {
      slug,
      title: parsed.title,
      summary: parsed.summary,
      body: parsed.body,
      sourceUrls: cluster.members.map((m) => m.url),
      category: 'daily-overview',
    },
  });
}


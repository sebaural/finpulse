import { fetchWorldNewsFeeds, clusterAndWeight, isGeopoliticsRelevant, StoryCluster } from './overview-ingest';
import { generateWithRunpod, RUNPOD_MODEL } from './runpod';
import { getPrisma } from './db';
import {
  OVERVIEW_CATEGORIES,
  OVERVIEW_CATEGORY_SLUGS,
  type OverviewCategorySlug,
} from './overview-categories';
import { Client } from '@upstash/qstash';
import { z } from 'zod';

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

const OverviewLlmOutputSchema = z.object({
  category: z.enum(OVERVIEW_CATEGORY_SLUGS as [OverviewCategorySlug, ...OverviewCategorySlug[]]),
  title: z.string().min(1),
  description: z.string().min(1), // one sentence
  summary: z.string().min(1), // 3-4 sentences
});

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

// Only ~5 of these candidates survive as final blocks (one per fixed
// category, chosen in processCluster), so the cap can sit well above 5 —
// this just bounds how many RunPod calls one run can fan out to.
const MAX_CANDIDATE_CLUSTERS = 20;

const PRIORITY_ORDER: Record<StoryCluster['priority'], number> = { high: 1, low: 0 };

function byPriorityThenRecency(a: StoryCluster, b: StoryCluster): number {
  const rank = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
  if (rank !== 0) return rank;
  return b.representative.publishedAt.getTime() - a.representative.publishedAt.getTime();
}

// Reserves the single best cluster per region (from clusters a dedicated
// region feed contributed to) so no region can be crowded out by the global
// priority cut below — e.g. Africa/East Asia clusters are rarely corroborated
// by as many Western outlets as US/Europe/Middle East ones, so without this
// they'd lose the top-N cut on a busy news day even when real regional news
// exists.
function reserveOnePerRegion(clusters: StoryCluster[]): StoryCluster[] {
  const reserved: StoryCluster[] = [];
  for (const slug of OVERVIEW_CATEGORY_SLUGS) {
    const candidates = clusters.filter((c) => c.regionHint === slug);
    if (candidates.length === 0) continue;
    reserved.push(candidates.sort(byPriorityThenRecency)[0]);
  }
  return reserved;
}

// Called by /api/overview/generate — picks the day's candidate clusters
export async function selectDailyClusters(): Promise<StoryCluster[]> {
  const rawStories = await fetchWorldNewsFeeds();
  const weighted = clusterAndWeight(rawStories);

  // A cluster from a dedicated region feed is presumptively on-topic for a
  // regional briefing without also needing to match the (narrow,
  // conflict-flavored) geopolitics keyword list.
  const geopoliticsOnly = weighted.filter(
    (c) => c.regionHint || c.members.some((m) => isGeopoliticsRelevant(m))
  );

  const reserved = reserveOnePerRegion(geopoliticsOnly);
  const reservedSet = new Set(reserved);
  const remainder = geopoliticsOnly
    .filter((c) => !reservedSet.has(c))
    .sort(byPriorityThenRecency);

  return [...reserved, ...remainder].slice(0, MAX_CANDIDATE_CLUSTERS);
}

// 'YYYY-MM-DD' (UTC) as a bare Date at UTC midnight, matching how the
// publishedDate @db.Date column round-trips through Prisma.
function todayDateColumn(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

type Prisma = ReturnType<typeof getPrisma>;

async function getOrCreateOverviewDay(prisma: Prisma, publishedDate: Date) {
  const existing = await prisma.overviewDay.findUnique({ where: { publishedDate } });
  if (existing) return existing;

  try {
    return await prisma.overviewDay.create({ data: { publishedDate } });
  } catch (err) {
    // Concurrent QStash jobs for the same day can race on the unique
    // publishedDate key — the loser just reads back the winner's row.
    if (isUniqueConstraintError(err)) {
      const raced = await prisma.overviewDay.findUnique({ where: { publishedDate } });
      if (raced) return raced;
    }
    throw err;
  }
}

const FALLBACK_MODEL_TAG = 'fallback';

/**
 * Fills any of the 5 fixed categories still missing a block for the given
 * day with a deterministic "no major developments" block — no RunPod call
 * involved. Safe to call redundantly (idempotent upsert).
 */
export async function ensureAllCategoriesFilled(dayId: string) {
  const prisma = getPrisma();

  const existing = await prisma.overviewBlock.findMany({
    where: { dayId },
    select: { category: true },
  });
  const filled = new Set(existing.map((b) => b.category));
  const missing = OVERVIEW_CATEGORY_SLUGS.filter((slug) => !filled.has(slug));

  await Promise.all(
    missing.map((slug) =>
      prisma.overviewBlock
        .upsert({
          where: { dayId_category: { dayId, category: slug } },
          update: {},
          create: {
            dayId,
            category: slug,
            title: `${OVERVIEW_CATEGORIES[slug].label} — No Major Developments`,
            description:
              'No significant geopolitical developments were reported for this region today.',
            summary:
              'Our sources did not surface a qualifying story for this region in the past 24 hours. Check back for the next briefing.',
            model: FALLBACK_MODEL_TAG,
          },
        })
        .catch((err) => {
          // Another concurrent call may have just created the same row —
          // that's fine, nothing left to do for this category.
          if (!isUniqueConstraintError(err)) throw err;
        })
    )
  );
}

// Bounds how far back finalizeUnfinishedOverviewDays looks for a stranded
// day, so the query stays cheap indefinitely — well beyond how long a
// single missed cron run could plausibly go unnoticed.
const FINALIZE_LOOKBACK_DAYS = 30;

/**
 * A day only ever receives new writes from same-day QStash jobs, so once a
 * day is no longer "today" its set of blocks is final. This backfills any
 * region a past day's run never got a qualifying cluster for.
 *
 * Scans a bounded window of past days rather than just "yesterday" so that a
 * single missed cron run (an outage, a failed deploy, etc.) can't
 * permanently strand a day short of all 5 regions — `ensureAllCategoriesFilled`
 * is idempotent, so re-checking already-complete days here is a cheap no-op.
 * Runs at the start of each day's generate call, before today's own fan-out.
 */
export async function finalizeUnfinishedOverviewDays() {
  const prisma = getPrisma();
  const today = todayDateColumn();
  const windowStart = new Date(today);
  windowStart.setUTCDate(windowStart.getUTCDate() - FINALIZE_LOOKBACK_DAYS);

  const days = await prisma.overviewDay.findMany({
    where: { publishedDate: { gte: windowStart, lt: today } },
    include: { _count: { select: { blocks: true } } },
  });

  const unfinished = days.filter((d) => d._count.blocks < OVERVIEW_CATEGORY_SLUGS.length);
  await Promise.all(unfinished.map((day) => ensureAllCategoriesFilled(day.id)));
}

// Called by /api/overview/generate — finalizes any unfinished past days,
// then fans today's candidate clusters out to QStash, one job each
export async function enqueueDailyClusters() {
  await finalizeUnfinishedOverviewDays().catch((err) =>
    console.error('[overview/generate] failed to finalize previous days', err)
  );

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
        // Must exceed maxDuration (300s) on /api/overview/process — the RunPod
        // poll loop in runpod.ts can legitimately run close to that. Without
        // this, QStash's own default callback timeout could fire first and
        // retry the job while the original invocation is still in flight,
        // doubling RunPod usage for the same cluster.
        timeout: '295s',
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
// so each call stays well within maxDuration = 300 regardless of RunPod's
// MAX_CONCURRENCY=2 limit or overall batch size.
// RSS titles/snippets are third-party content — strip stray markup before
// it's interpolated into the LLM prompt.
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

  const categoryList = OVERVIEW_CATEGORY_SLUGS.map(
    (slug) => `"${slug}" (${OVERVIEW_CATEGORIES[slug].label})`
  ).join(', ');

  // When the cluster came from a dedicated region feed, the region is already
  // known — telling the model outright (rather than asking it to classify)
  // avoids misclassification for these guaranteed-coverage candidates. It's
  // still asked to echo "category" back so the schema stays uniform; the
  // value actually used below is `cluster.regionHint`, not the model's.
  const regionInstruction = cluster.regionHint
    ? `This story is from our ${OVERVIEW_CATEGORIES[cluster.regionHint].label} desk — set ` +
      `"category" to exactly "${cluster.regionHint}".`
    : `Classify the story into exactly one of these regions: ${categoryList}.`;

  const messages = [
    {
      role: 'system',
      content:
        'You are a geopolitics news editor synthesizing one short block for a daily regional ' +
        `briefing. ${regionInstruction} ` +
        'The source snippets below may cover the same underlying event from multiple outlets, ' +
        'sometimes with inconsistent details (e.g. two different names for who did something). ' +
        'Reconcile this yourself: write about the single event the snippets corroborate, using ' +
        'the detail the majority of sources agree on; only mention a conflicting detail if you ' +
        'attribute it explicitly to the specific source that reported it. Never present ' +
        'contradictory facts side by side as if both were confirmed. ' +
        'Write the "title" in an analytical voice, not wire-style attribution ("X says Y") — ' +
        'lead with why the development matters or what it signals, not just what was said. ' +
        'The "description" is a one-sentence blurb shown alongside the title, so it must add ' +
        'information the title does not already convey — a concrete consequence, stake, ' +
        'timeline, or detail — never a rephrasing of the title. ' +
        'Respond ONLY with raw JSON (no markdown fences): ' +
        '{"category": "...", "title": "...", "description": "...", "summary": "..."}. ' +
        '"category" must be exactly one of the region values above. "description" must be ' +
        'exactly one sentence and must not restate "title". "summary" must be 3-4 sentences that ' +
        'synthesize the sources into one coherent account (not a list of separate claims) and add ' +
        'context or implications beyond the description. Do not use asterisks, markdown bold, markdown bullets, or HTML tags anywhere.',
    },
    { role: 'user', content: sourceText },
  ];

  const choiceContent = await generateWithRunpod(messages);

  const cleanJson = extractJson(choiceContent);
  const parsed = OverviewLlmOutputSchema.parse(JSON.parse(cleanJson));

  // Trust the feed's region over the model's own classification when known —
  // see regionInstruction above.
  const category = cluster.regionHint ?? parsed.category;

  const day = await getOrCreateOverviewDay(prisma, todayDateColumn());

  const existingBlock = await prisma.overviewBlock.findUnique({
    where: { dayId_category: { dayId: day.id, category } },
  });

  // Race guard: independent QStash jobs can classify different raw clusters
  // into the same category on the same day. Only a `high`-priority
  // (multi-source-corroborated) cluster is allowed to overwrite whatever is
  // already there, so a later `low`-priority job can't clobber an
  // already-corroborated block purely by finishing last.
  if (existingBlock && PRIORITY_ORDER[cluster.priority] < 1) {
    console.log(
      `[overview/process] skipping ${category} for ${day.publishedDate.toISOString()} — ` +
        `block already exists and this cluster's priority ('${cluster.priority}') isn't high enough to replace it`
    );
    return;
  }

  await prisma.overviewBlock.upsert({
    where: { dayId_category: { dayId: day.id, category } },
    update: {
      title: parsed.title,
      description: parsed.description,
      summary: parsed.summary,
      model: RUNPOD_MODEL,
    },
    create: {
      dayId: day.id,
      category,
      title: parsed.title,
      description: parsed.description,
      summary: parsed.summary,
      model: RUNPOD_MODEL,
    },
  });
}

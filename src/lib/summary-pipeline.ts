import { Client } from '@upstash/qstash';
import { extractJson, generateWithRunpod } from '@/lib/runpod';
import { getPrisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client/client';

type Vertical = 'geopolitics' | 'markets' | 'tech' | 'pulse';

/**
 * Slug uniqueness guard across all article tables.
 *
 * Slug has no unique constraint in any table (only title is unique), and the
 * same slug is ambiguous both across verticals and within one: /topics/ and
 * legacy routes resolve a slug with findFirst, so a second row with that slug
 * is unreachable. Every table is checked, including the one being written
 * into; pass `ignore` to skip the row being updated so it doesn't collide with
 * itself.
 */
export async function isSlugTakenAcrossVerticals(
  slug: string,
  ignore?: { vertical: Vertical; id: string },
): Promise<boolean> {
  const prisma = getPrisma();
  const notId = (vertical: Vertical) =>
    ignore?.vertical === vertical ? { id: { not: ignore.id } } : {};
  const [geo, mkt, tech, pulse] = await Promise.all([
    prisma.geopoliticsArticle.findFirst({ where: { slug, ...notId('geopolitics') }, select: { id: true } }),
    prisma.marketsArticle.findFirst({ where: { slug, ...notId('markets') }, select: { id: true } }),
    prisma.techArticle.findFirst({ where: { slug, ...notId('tech') }, select: { id: true } }),
    prisma.pulseArticle.findFirst({ where: { articleSlug: slug, ...notId('pulse') }, select: { id: true } }),
  ]);
  return !!(geo || mkt || tech || pulse);
}

/**
 * Returns `base` if it's free, otherwise the first free slug in the sequence
 * `{base}-{vertical}`, `{base}-{vertical}-2`, `{base}-{vertical}-3`, ...
 * Disambiguates rather than dropping the article, so a day's content is never
 * silently lost. Pass `ownId` when updating an existing row.
 */
export async function resolveUniqueSlug(
  base: string,
  vertical: Exclude<Vertical, 'pulse'>,
  ownId?: string,
): Promise<string> {
  const ignore = ownId ? { vertical, id: ownId } : undefined;
  let candidate = base;
  let attempt = 1;
  while (await isSlugTakenAcrossVerticals(candidate, ignore)) {
    candidate = attempt === 1 ? `${base}-${vertical}` : `${base}-${vertical}-${attempt}`;
    attempt += 1;
  }
  if (candidate !== base) {
    console.warn(`[pipeline] Slug collision: "${base}" — disambiguating as "${candidate}"`);
  }
  return candidate;
}

// ---------------------------------------------------------------------------
// Topic (entity/theme hub) assignment
// ---------------------------------------------------------------------------

export interface TopicChoice {
  name: string;
  slug: string;
}

/**
 * Existing topic hubs for a vertical, most-recently-updated first. Fed into the
 * generation prompt so Claude reuses an existing hub when one fits, instead of
 * minting a near-duplicate every run (which would fragment the hubs).
 */
export async function getTopicChoices(vertical: Vertical, limit = 40): Promise<TopicChoice[]> {
  try {
    const prisma = getPrisma();
    return await prisma.topic.findMany({
      where: { parentVertical: vertical },
      select: { name: true, slug: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  } catch (error) {
    console.error('[pipeline] failed to load topic choices', error);
    return [];
  }
}

/**
 * Prompt block instructing the model to assign the briefing to one broad,
 * evergreen topic hub — reusing an existing one when it genuinely fits.
 */
export function buildTopicDirective(choices: TopicChoice[]): string {
  const list = choices.length
    ? choices.map((c) => `  - ${c.name} (${c.slug})`).join('\n')
    : '  (none yet — you will be creating the first topic hub for this vertical)';
  return (
    `TOPIC HUB ASSIGNMENT:\n` +
    `Assign this briefing to exactly ONE broad, evergreen topic hub — a durable entity or\n` +
    `theme that many future briefings could also belong to (e.g. "Federal Reserve Policy",\n` +
    `"US-China Relations", "Artificial Intelligence"), NOT the narrow angle of today's story.\n` +
    `Strongly prefer reusing one of these EXISTING hubs when it genuinely fits:\n` +
    `${list}\n` +
    `Only invent a new hub when none of the above fit. The slug must be 1-4 lowercase words\n` +
    `joined by hyphens (letters and hyphens only).\n\n`
  );
}

type BriefingVertical = Exclude<Vertical, 'pulse'>;

// What each daily briefing leads with. All three pipelines read the same macro
// headlines, so without lanes they publish three near-identical articles a day
// (Fed + Iran sanctions + earnings), which Google treats as duplicate content.
const VERTICAL_LANES: Record<BriefingVertical, string> = {
  geopolitics:
    'states, conflicts, alliances, sanctions and diplomacy. Do NOT lead with central-bank ' +
    'policy, CPI data or corporate earnings — mention them only as consequences.',
  markets:
    'asset prices, rates, earnings, macro data and capital flows. Do NOT lead with diplomacy ' +
    'or technology products — mention them only through their market impact.',
  tech:
    'technology companies, semiconductors, AI, platforms and tech regulation. Do NOT lead with ' +
    'sanctions, oil or inflation prints — mention them only as they affect the tech sector.',
};

/**
 * Titles the OTHER briefing verticals published in the last 24h. The cron runs
 * the pipelines sequentially, so later verticals see earlier ones' output.
 */
export async function getRecentBriefingTitles(
  vertical: BriefingVertical,
  hours = 24,
): Promise<string[]> {
  try {
    const prisma = getPrisma();
    const where = { createdAt: { gte: new Date(Date.now() - hours * 3600_000) } };
    const select = { title: true } as const;
    const [geo, mkt, tech] = await Promise.all([
      vertical === 'geopolitics' ? [] : prisma.geopoliticsArticle.findMany({ where, select }),
      vertical === 'markets' ? [] : prisma.marketsArticle.findMany({ where, select }),
      vertical === 'tech' ? [] : prisma.techArticle.findMany({ where, select }),
    ]);
    return [...geo, ...mkt, ...tech].map((r) => r.title);
  } catch (error) {
    console.error('[pipeline] failed to load recent briefing titles', error);
    return [];
  }
}

/** Prompt block keeping each vertical in its own lane and off today's other briefings. */
export function buildLaneDirective(vertical: BriefingVertical, otherTitles: string[]): string {
  const others = otherTitles.length
    ? `Today's other MacroStance briefings already cover:\n` +
      otherTitles.map((t) => `  - ${t}`).join('\n') +
      `\nChoose a different lead story and a different angle from these; do not repeat their\n` +
      `headline themes.\n`
    : '';
  return (
    `EDITORIAL LANE:\n` +
    `This is the ${vertical} briefing. Lead with ${VERTICAL_LANES[vertical]}\n` +
    others +
    `\n`
  );
}

/**
 * Find-or-create a topic hub by slug and return its id (or null on failure).
 * Slug is globally unique, so a hub minted under one vertical is reused across
 * all verticals; an existing hub's name/parentVertical are left untouched.
 */
export async function upsertTopic(choice: TopicChoice, vertical: Vertical): Promise<string | null> {
  const slug = canonicalizeSlug(choice.slug || choice.name);
  if (!slug) return null;
  try {
    const prisma = getPrisma();
    const topic = await prisma.topic.upsert({
      where: { slug },
      update: {},
      create: { name: choice.name?.trim() || slug, slug, parentVertical: vertical },
    });
    return topic.id;
  } catch (error) {
    console.error(`[pipeline] topic upsert failed for slug "${slug}"`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Topic "storyline" copy — distinct text for /topics/{topic}/{slug}
// ---------------------------------------------------------------------------

export interface TopicCopy {
  topicTitle: string;
  topicSummary: string;
  topicKeyPoints: string[];
}

export interface RecentTopicArticle {
  title: string;
  date: string;
  keyPoints: string[];
}

/**
 * Earlier briefings in the same topic hub (all three verticals), newest first.
 * Feeds the storyline prompt so the /topics copy can trace how the topic got here.
 */
export async function getRecentTopicArticles(
  topicId: string,
  excludeId?: string,
  limit = 5,
): Promise<RecentTopicArticle[]> {
  try {
    const prisma = getPrisma();
    const where = { topicId, ...(excludeId ? { id: { not: excludeId } } : {}) };
    const select = { title: true, date: true, keyPoints: true, createdAt: true } as const;
    const args = { where, select, orderBy: { createdAt: 'desc' as const }, take: limit };
    const [geo, mkt, tech] = await Promise.all([
      prisma.geopoliticsArticle.findMany(args),
      prisma.marketsArticle.findMany(args),
      prisma.techArticle.findMany(args),
    ]);
    return [...geo, ...mkt, ...tech]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((r) => ({
        title: r.title,
        date: r.date,
        keyPoints: Array.isArray(r.keyPoints) ? (r.keyPoints as string[]) : [],
      }));
  } catch (error) {
    console.error('[pipeline] failed to load recent topic articles', error);
    return [];
  }
}

// The /topics article's own Title, Summary and Key points are generated on
// RunPod (Llama 3.1 8B, same endpoint as Pulse/Overview) by a QStash job that
// runs after the daily briefing is saved. A cold RunPod worker can take minutes,
// which would not fit inside the shared 300s /api/cron/generate function, so
// saveSummaryArticle only enqueues; /api/topics/process does the generation.

const TOPIC_SECTION_HEADERS = ['WHAT CHANGED', 'HOW WE GOT HERE', 'SIGNALS TO WATCH'] as const;

// Distinctness thresholds vs the daily /{vertical}/{slug} copy.
const MAX_TITLE_JACCARD = 0.5;
const SHINGLE_SIZE = 8;
const MAX_SHINGLE_OVERLAP = 0.03;

// The in-job retry only runs if the first attempt finished within this time.
// A warm Llama 8B call for ~1800 tokens takes about 60-90s.
const SECOND_ATTEMPT_CUTOFF_MS = 120_000;

const TITLE_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'on', 'in', 'to', 'for', 'with', 'as', 'at', 'by',
  'from', 'is', 'are', 'its', 'it', 'how', 'why', 'what', 'amid', 'over', 'into', 'vs',
]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function titleJaccard(a: string, b: string): number {
  const ta = new Set(words(a).filter((w) => !TITLE_STOP_WORDS.has(w)));
  const tb = new Set(words(b).filter((w) => !TITLE_STOP_WORDS.has(w)));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / (ta.size + tb.size - inter);
}

function shingles(text: string, n = SHINGLE_SIZE): Set<string> {
  const w = words(text);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
}

/** Share of the topic text's 8-word shingles that also appear in the daily copy. */
function shingleOverlap(topicText: string, dailyText: string): number {
  const topic = shingles(topicText);
  if (topic.size === 0) return 0;
  const daily = shingles(dailyText);
  let hits = 0;
  for (const s of topic) if (daily.has(s)) hits++;
  return hits / topic.size;
}

export interface DistinctnessReport {
  ok: boolean;
  titleJaccard: number;
  summaryOverlap: number;
  copiedKeyPoint: string | null;
}

/**
 * The /topics article must not duplicate the daily /{vertical}/{slug} article:
 * a different headline and different wording, enforced here rather than only
 * requested in the prompt.
 */
export function checkTopicCopyDistinct(
  copy: TopicCopy,
  daily: { title: string; summary: string; keyPoints: string[] },
): DistinctnessReport {
  const tj = titleJaccard(copy.topicTitle, daily.title);
  const sameTitle = copy.topicTitle.trim().toLowerCase() === daily.title.trim().toLowerCase();
  const dailyText = [daily.summary, ...daily.keyPoints].join('\n');
  const topicText = [copy.topicSummary, ...copy.topicKeyPoints].join('\n');
  const overlap = shingleOverlap(topicText, dailyText);
  const norm = (s: string) => words(s).join(' ');
  const topicNorm = norm(topicText);
  const copiedKeyPoint =
    daily.keyPoints.find((p) => {
      const n = norm(p);
      return n.split(' ').length >= 5 && topicNorm.includes(n);
    }) ?? null;
  return {
    ok: !sameTitle && tj < MAX_TITLE_JACCARD && overlap <= MAX_SHINGLE_OVERLAP && !copiedKeyPoint,
    titleJaccard: Number(tj.toFixed(3)),
    summaryOverlap: Number(overlap.toFixed(3)),
    copiedKeyPoint,
  };
}

/**
 * Llama 8B leaks markdown/HTML into JSON strings. Strip it, but keep the three
 * section headers as their own blocks — the /topics page splits the summary on
 * blank lines and renders those headers as <h2>.
 */
export function cleanTopicSummary(text: string): string {
  let t = text
    .replace(/\r\n/g, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\*\*|__|`/g, '')
    .replace(/^\s{0,3}#{1,6}\s*/gm, '')
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '');
  // Put each header on its own block, whatever the model did around it
  // ("WHAT CHANGED: text", "What changed\ntext", "...text. HOW WE GOT HERE ...").
  // Case-sensitive on purpose: "what changed" mid-sentence is prose, not a header.
  for (const h of TOPIC_SECTION_HEADERS) {
    const re = new RegExp(`\\s*\\b${h.replace(/ /g, '\\s+')}\\b\\s*[:—–-]?\\s*`, 'g');
    t = t.replace(re, `\n\n${h}\n\n`);
  }
  return t
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim())
    .filter(Boolean)
    .join('\n\n');
}

function cleanLine(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\*\*|__|\*|`/g, '')
    .replace(/^\s*#+\s*/, '')
    .replace(/^\s*(?:[-•]|\d+[.)])\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildTopicCopyMessages(input: {
  vertical: BriefingVertical;
  topicName: string;
  title: string;
  keyPoints: string[];
  earlierBlock: string;
  retryNote?: string;
}): { role: string; content: string }[] {
  const system =
    'You are a senior macro editor who tracks long-running stories across many daily briefings. ' +
    'You write the TOPIC page for a story, which is a different article from the daily briefing. ' +
    'Respond with ONE valid JSON object and nothing else: no markdown, no code fences, no commentary.';

  const user =
    `Topic hub: "${input.topicName}" (${input.vertical}).\n\n` +
    `Today's daily briefing headline (published on another page — do NOT reuse it):\n` +
    `"${input.title}"\n` +
    `Its takeaways (context only — do NOT copy or paraphrase these):\n` +
    input.keyPoints.map((p) => `- ${p}`).join('\n') +
    `\n\nEarlier briefings in this topic:\n${input.earlierBlock}\n\n` +
    `Write the topic-page article: how today's development moves the "${input.topicName}" story ` +
    `forward, measured against the earlier briefings.\n` +
    `Rules:\n` +
    `- topicTitle: a NEW headline about the topic's trajectory. Use different key words from today's headline.\n` +
    `- topicSummary: 350-500 words of plain prose in exactly three sections. Each section starts with its\n` +
    `  header on its own line, then a blank line, then paragraphs separated by blank lines:\n` +
    `  WHAT CHANGED\n  HOW WE GOT HERE\n  SIGNALS TO WATCH\n` +
    `- topicKeyPoints: 4-6 short topic-level implications (not today's facts), each a full sentence.\n` +
    `- Refer to earlier briefings by their date where relevant.\n` +
    `- Write every sentence in your own words. Never copy a sentence from the takeaways above.\n` +
    `- Do not invent statistics, quotes, or people/organisation names that are not in the input.\n` +
    `- No markdown, no asterisks, no bullet symbols inside strings.\n` +
    (input.retryNote ? `- IMPORTANT: ${input.retryNote}\n` : '') +
    `\nJSON shape:\n` +
    `{"topicTitle": "...", "topicSummary": "WHAT CHANGED\\n\\n...\\n\\nHOW WE GOT HERE\\n\\n...\\n\\nSIGNALS TO WATCH\\n\\n...", "topicKeyPoints": ["...", "..."]}`;

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

/**
 * Llama 8B routinely writes literal newlines/tabs inside JSON string values
 * (the summary's paragraph breaks), which strict JSON.parse rejects. Escape
 * control characters that occur inside string literals; leave the rest alone.
 */
function escapeControlCharsInStrings(json: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  for (const ch of json) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      } else if (ch === '\n') {
        out += '\\n';
        continue;
      } else if (ch === '\r') {
        continue;
      } else if (ch === '\t') {
        out += '\\t';
        continue;
      } else if (ch < ' ') {
        continue;
      }
    } else if (ch === '"') {
      inString = true;
    }
    out += ch;
  }
  return out;
}

export function parseTopicCopy(raw: string): TopicCopy | null {
  let parsed: Partial<Record<keyof TopicCopy, unknown>>;
  try {
    parsed = JSON.parse(escapeControlCharsInStrings(extractJson(raw)));
  } catch (error) {
    console.warn('[topics] RunPod output was not valid JSON:', String(error), raw.slice(0, 300));
    return null;
  }
  const title = typeof parsed.topicTitle === 'string' ? cleanLine(parsed.topicTitle) : '';
  const summary = typeof parsed.topicSummary === 'string' ? cleanTopicSummary(parsed.topicSummary) : '';
  const keyPoints = Array.isArray(parsed.topicKeyPoints)
    ? parsed.topicKeyPoints
        .filter((p): p is string => typeof p === 'string')
        .map(cleanLine)
        .filter((p) => p.length > 0)
    : [];
  if (!title || !summary || keyPoints.length === 0) {
    console.warn('[topics] RunPod output incomplete (title/summary/keyPoints missing)');
    return null;
  }
  const presentHeaders = TOPIC_SECTION_HEADERS.filter((h) => summary.includes(h));
  if (presentHeaders.length < 2) {
    console.warn(`[topics] RunPod summary missing section headers (found ${presentHeaders.length}/3)`);
    return null;
  }
  return { topicTitle: title, topicSummary: summary, topicKeyPoints: keyPoints.slice(0, 6) };
}

/**
 * Generates the /topics article (Title, Summary, Key points) on RunPod and
 * enforces that it differs from the daily copy. One in-job retry with a
 * corrective note; returns null if nothing acceptable came back. RunPod
 * transport errors propagate so the QStash job is retried.
 */
export async function generateTopicCopy(input: {
  vertical: BriefingVertical;
  topicId: string;
  excludeId?: string;
  title: string;
  summary: string;
  keyPoints: string[];
}): Promise<TopicCopy | null> {
  const prisma = getPrisma();
  const [topic, earlier] = await Promise.all([
    prisma.topic.findUnique({ where: { id: input.topicId }, select: { name: true } }),
    getRecentTopicArticles(input.topicId, input.excludeId),
  ]);
  if (!topic) return null;

  const earlierBlock = earlier.length
    ? earlier
        .map((a) => `- ${a.date}: ${a.title}\n` + a.keyPoints.slice(0, 3).map((p) => `    • ${p}`).join('\n'))
        .join('\n')
    : '- (no earlier briefings in this topic yet)';

  const daily = { title: input.title, summary: input.summary, keyPoints: input.keyPoints };
  let retryNote: string | undefined;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= 2; attempt++) {
    // A cold first attempt can eat most of /api/topics/process's 300s budget.
    // Only retry in-job when the worker was warm; otherwise return null and let
    // QStash's retry (a fresh invocation hitting the now-warm worker) handle it.
    if (attempt > 1 && Date.now() - startedAt > SECOND_ATTEMPT_CUTOFF_MS) {
      console.warn(`[topics] skipping in-job retry after ${Math.round((Date.now() - startedAt) / 1000)}s`);
      break;
    }
    const raw = await generateWithRunpod(
      buildTopicCopyMessages({
        vertical: input.vertical,
        topicName: topic.name,
        title: input.title,
        keyPoints: input.keyPoints,
        earlierBlock,
        retryNote,
      }),
      { maxTokens: 1800 },
    );
    const copy = parseTopicCopy(raw);
    if (!copy) {
      retryNote =
        'Your previous answer was not valid JSON with all three fields and the section headers. ' +
        'Follow the JSON shape exactly.';
      continue;
    }
    const report = checkTopicCopyDistinct(copy, daily);
    console.log(
      `[topics] attempt ${attempt}: title="${copy.topicTitle}" titleJaccard=${report.titleJaccard} ` +
        `summaryOverlap=${report.summaryOverlap} copiedKeyPoint=${report.copiedKeyPoint ? 'yes' : 'no'}`,
    );
    if (report.ok) return copy;
    retryNote =
      `Your previous headline "${copy.topicTitle}" or wording was too similar to the daily briefing. ` +
      `Use a clearly different headline (different key words) and entirely your own sentences.`;
  }
  return null;
}

export interface TopicCopyJob {
  vertical: BriefingVertical;
  articleId: string;
  title: string;
}

const topicsQstash = new Client({ token: process.env.QSTASH_TOKEN ?? '' });

// VERCEL_URL (injected by Vercel, no protocol) targets this exact deployment;
// SITE_URL is the local-dev fallback — same as pulse/overview.
function selfBaseUrl(): string | undefined {
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.SITE_URL;
}

/**
 * Called from each vertical's saveSummaryArticle after the row is written.
 * Never throws — the daily article is already saved.
 */
export async function enqueueTopicCopy(job: TopicCopyJob): Promise<boolean> {
  try {
    // x-vercel-protection-bypass: VERCEL_URL sits behind Deployment Protection.
    // timeout must exceed /api/topics/process's runtime so QStash doesn't retry
    // (and double-bill RunPod) while the first attempt is still running.
    await topicsQstash.publishJSON({
      url: `${selfBaseUrl()}/api/topics/process`,
      body: job,
      headers: { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? '' },
      timeout: '295s',
      retries: 2,
    });
    console.log(`[topics] enqueued topic copy for ${job.vertical} "${job.title}"`);
    return true;
  } catch (error) {
    console.error(`[topics] enqueue failed for ${job.vertical} "${job.title}"`, error);
    return false;
  }
}

async function loadBriefingRow(vertical: BriefingVertical, id: string) {
  const prisma = getPrisma();
  const select = { id: true, topicId: true, title: true, summary: true, keyPoints: true } as const;
  if (vertical === 'geopolitics') return prisma.geopoliticsArticle.findUnique({ where: { id }, select });
  if (vertical === 'markets') return prisma.marketsArticle.findUnique({ where: { id }, select });
  return prisma.techArticle.findUnique({ where: { id }, select });
}

async function writeTopicCopy(vertical: BriefingVertical, id: string, copy: TopicCopy) {
  const prisma = getPrisma();
  const data = topicCopyFields(copy);
  if (vertical === 'geopolitics') await prisma.geopoliticsArticle.update({ where: { id }, data });
  else if (vertical === 'markets') await prisma.marketsArticle.update({ where: { id }, data });
  else await prisma.techArticle.update({ where: { id }, data });
}

/**
 * QStash worker body (/api/topics/process). Stale jobs return normally;
 * a failed generation throws so QStash retries (bounded by `retries: 2`).
 */
export async function processTopicCopy(
  job: TopicCopyJob,
): Promise<{ status: 'written' | 'stale'; title?: string }> {
  if (!['geopolitics', 'markets', 'tech'].includes(job?.vertical) || !job.articleId) {
    console.warn('[topics] malformed job, dropping', job);
    return { status: 'stale' };
  }
  const row = await loadBriefingRow(job.vertical, job.articleId);
  // A same-day re-run may have replaced this article; that run enqueued its own job.
  if (!row || !row.topicId || row.title !== job.title) {
    console.log(`[topics] stale job for ${job.vertical} "${job.title}", skipping`);
    return { status: 'stale' };
  }

  const copy = await generateTopicCopy({
    vertical: job.vertical,
    topicId: row.topicId,
    excludeId: row.id,
    title: row.title,
    summary: row.summary,
    keyPoints: Array.isArray(row.keyPoints) ? (row.keyPoints as string[]) : [],
  });
  if (!copy) {
    throw new Error(`no acceptable topic copy for ${job.vertical} "${job.title}"`);
  }

  await writeTopicCopy(job.vertical, row.id, copy);
  console.log(`[topics] wrote topic copy for ${job.vertical} "${job.title}" → "${copy.topicTitle}"`);
  return { status: 'written', title: copy.topicTitle };
}

/**
 * Row fields for the topic copy. Always sets all three, so a same-day re-run
 * that fails to produce copy clears the previous run's (now mismatched) text.
 */
export function topicCopyFields(copy: TopicCopy | null) {
  return {
    topicTitle: copy?.topicTitle ?? null,
    topicSummary: copy?.topicSummary ?? null,
    topicKeyPoints: copy ? copy.topicKeyPoints : Prisma.DbNull,
  };
}

interface SourceArticleLike {
  title: string;
  url: string;
  publishedAt: string;
  description?: string;
}

export function safeDecodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function canonicalizeSlug(slug: string): string {
  return safeDecodeSlug(slug)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function toSlug(title: string): string {
  return canonicalizeSlug(title);
}

// Claude sometimes wraps JSON output in markdown code fences (```json ... ```)
// despite being told not to. Strip any surrounding fence before parsing so the
// generation pipelines don't fail on an otherwise-valid response.
export function parseClaudeJson<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/, '')
      .trim();
  }
  return JSON.parse(cleaned) as T;
}

export function selectImportantArticles<T extends SourceArticleLike>(
  articles: T[],
  detectImportance: (text: string) => number,
  domainLabel: string,
  limit = 5,
): T[] {
  const seenUrls = new Set<string>();
  const deduped: T[] = [];

  for (const article of articles) {
    const key = article.url.trim().toLowerCase();
    if (key && seenUrls.has(key)) continue;
    if (key) seenUrls.add(key);
    deduped.push(article);
  }

  const blockedDomains = ['rt.com'];
  const filtered = deduped.filter(
    (article) => !blockedDomains.some((domain) => article.url.toLowerCase().includes(domain)),
  );

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  const important = sorted.filter(
    (article) => detectImportance(`${article.title} ${article.description ?? ''}`) === 2,
  );

  if (important.length === 0) {
    throw new Error(
      `No "important" (priority-dot important) ${domainLabel} articles found across configured providers in the last 2 days. Pipeline aborted — will retry on next cron run.`,
    );
  }

  return important.slice(0, limit);
}

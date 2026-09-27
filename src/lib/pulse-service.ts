import { Client } from '@upstash/qstash';
import { z } from 'zod';
import { getPrisma } from '@/lib/db';
import { isHtmlFragment, sanitizeArticleHtml } from '@/lib/article-html';
import { notifyBing } from '@/lib/indexnow';
import type { RawStory } from '@/lib/overview-ingest';
import { PULSE_CATEGORIES, PULSE_SLUGS } from '@/lib/pulse-categories';
import { fetchPulseStoriesByCategory, pulseSourceKey, rankPulseClusters } from '@/lib/pulse-ingest';
import { extractJson, generateWithRunpod, RUNPOD_MODEL } from '@/lib/runpod';
import { canonicalizeSlug, isSlugTakenAcrossVerticals } from '@/lib/summary-pipeline';
import { SITE_URL } from '@/lib/seo';
import type { PulseArticle, PulseSlug } from '@/types/pulse';

interface PulseArticleDelegateLike {
  findMany: <T = unknown>(...args: unknown[]) => Promise<T[]>;
  findUnique: <T = unknown>(...args: unknown[]) => Promise<T | null>;
  create: <T = unknown>(...args: unknown[]) => Promise<T>;
}

interface PulseArticleRow {
  pulseSlug: string;
  articleSlug: string;
  title: string;
  summary: string | null;
  body: string | null;
  sourceUrl: string | null;
  category: string;
  observedStart: Date | null;
  observedEnd: Date | null;
  publishedAt: Date | null;
  raw: unknown;
}

interface PulseExistingRow {
  articleSlug: string;
  sourceUrl: string | null;
  raw: unknown;
}

function shouldThrowPulseReadErrors(): boolean {
  return process.env.NODE_ENV === 'production';
}

function getPulseDelegate(): PulseArticleDelegateLike | null {
  const prisma = getPrisma() as unknown as { pulseArticle?: PulseArticleDelegateLike };
  if (!prisma.pulseArticle) {
    const message =
      '[pulse-service] prisma.pulseArticle is unavailable. Regenerate Prisma client and restart the server.';
    console.error(message);
    if (shouldThrowPulseReadErrors()) {
      throw new Error(message);
    }
    return null;
  }
  return prisma.pulseArticle;
}

const MONTH_TOKENS = new Set([
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
  'jan',
  'feb',
  'mar',
  'apr',
  'jun',
  'jul',
  'aug',
  'sep',
  'sept',
  'oct',
  'nov',
  'dec',
]);

const RELATIVE_TIME_TOKENS = new Set([
  'today',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'yesterday',
  'tomorrow',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

const STOP_WORD_TOKENS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'for',
  'with',
  'from',
  'into',
  'onto',
  'over',
  'under',
  'across',
  'amid',
  'after',
  'before',
  'during',
  'through',
  'about',
  'this',
  'that',
  'these',
  'those',
  'update',
  'updates',
]);

function isDateLikeSlugToken(token: string): boolean {
  return (
    /^(19|20)\d{2}$/.test(token) ||
    /^q[1-4]$/i.test(token) ||
    MONTH_TOKENS.has(token) ||
    RELATIVE_TIME_TOKENS.has(token)
  );
}

function stripDateTokensFromSlug(slug: string): string {
  return canonicalizeSlug(slug)
    .split('-')
    .filter((token) => {
      if (!token) return false;
      if (!/^[a-z]+$/.test(token)) return false;
      if (/[0-9]/.test(token)) return false;
      if (isDateLikeSlugToken(token)) return false;
      return true;
    })
    .join('-');
}

function regeneratePulseSlug(title: string, summary: string, pulseSlug: PulseSlug): string {
  const tokens = canonicalizeSlug(`${title} ${summary} ${pulseSlug}`)
    .split('-')
    .filter((token) => {
      if (!token) return false;
      if (!/^[a-z]+$/.test(token)) return false;
      if (token.length < 3) return false;
      if (STOP_WORD_TOKENS.has(token)) return false;
      if (isDateLikeSlugToken(token)) return false;
      return true;
    });

  const deduped = [...new Set(tokens)];
  const preferred = deduped.slice(0, 5);
  const fallbackPad = ['macro', 'outlook', 'signal', 'briefing', pulseSlug].filter(
    (token) => !preferred.includes(token) && !isDateLikeSlugToken(token),
  );
  const finalTokens = [...preferred, ...fallbackPad].slice(0, 5);

  if (finalTokens.length < 4) {
    return `macro-${pulseSlug}-signal-briefing`;
  }

  return finalTokens.join('-');
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

function toPulseArticle(row: PulseArticleRow): PulseArticle {
  return {
    pulseSlug: row.pulseSlug as PulseSlug,
    articleSlug: row.articleSlug,
    title: row.title,
    summary: row.summary,
    body: row.body,
    sourceUrl: row.sourceUrl,
    category: row.category,
    observedStart: row.observedStart?.toISOString() ?? null,
    observedEnd: row.observedEnd?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    raw: row.raw,
  };
}

export async function getPulseArticles(pulseSlug: PulseSlug): Promise<PulseArticle[]> {
  try {
    const pulseArticle = getPulseDelegate();
    if (!pulseArticle) return [];

    const rows = await pulseArticle.findMany<PulseArticleRow>({
      where: { pulseSlug },
      orderBy: [{ observedStart: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toPulseArticle);
  } catch (error) {
    console.error('[pulse-service] failed to load pulse articles', error);
    if (shouldThrowPulseReadErrors()) {
      throw error;
    }
    return [];
  }
}

export async function getPulseArticleBySlug(
  pulseSlug: PulseSlug,
  articleSlug: string,
): Promise<PulseArticle | null> {
  try {
    const pulseArticle = getPulseDelegate();
    if (!pulseArticle) return null;

    const row = await pulseArticle.findUnique<PulseArticleRow>({
      where: { pulseSlug_articleSlug: { pulseSlug, articleSlug } },
    });
    return row ? toPulseArticle(row) : null;
  } catch (error) {
    console.error('[pulse-service] failed to load pulse article', error);
    if (shouldThrowPulseReadErrors()) {
      throw error;
    }
    return null;
  }
}

// Effective publish time for ordering: the observed date, falling back to the
// stored publish time. Legacy rows have a null observedStart, so relying on the
// DB's `observedStart desc` (NULLS FIRST in Postgres) would surface the oldest
// row as "latest" — compute the max explicitly instead.
function pulseArticleTime(article: PulseArticle): number {
  const value = article.observedStart ?? article.publishedAt;
  if (!value) return -Infinity;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? -Infinity : t;
}

export async function getLatestArticlePerCategory(): Promise<Record<PulseSlug, PulseArticle | null>> {
  const entries = await Promise.all(
    PULSE_SLUGS.map(async (slug) => {
      const articles = await getPulseArticles(slug);
      const latest = articles.reduce<PulseArticle | null>(
        (best, current) =>
          !best || pulseArticleTime(current) > pulseArticleTime(best) ? current : best,
        null,
      );
      return [slug, latest] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<PulseSlug, PulseArticle | null>;
}

// ---------------------------------------------------------------------------
// Generation: news feeds → RunPod (see pulse-ingest.ts for sourcing)
// ---------------------------------------------------------------------------
//
// Mirrors Overview's fan-out: the cron route only ingests + selects sources
// and enqueues one QStash job per category; /api/pulse/process then runs
// exactly one RunPod generation per invocation. A RunPod cold start (60-180s)
// plus a long generation wouldn't fit even two categories sequentially inside
// the 300s function cap.

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

// The primary cluster is what the article is about; a couple of other
// clusters from the same category go along as background only. Capped so the
// 8B model's prompt stays small and focused.
const MAX_PRIMARY_STORIES = 5;
const MAX_CONTEXT_CLUSTERS = 2;
const MAX_TOTAL_STORIES = 8;

// Pulse's six-section analysis runs far past RunPod's default completion
// budget — too low and the JSON is cut off mid-object.
const PULSE_MAX_TOKENS = 3000;

export interface PulseJobPayload {
  pulseSlug: PulseSlug;
  sourceId: string;
  primary: RawStory[];
  context: RawStory[];
}

interface PulseUsedSources {
  slugs: Set<string>;
  sourceKeys: Set<string>;
}

// Everything a category has already been written from: its sourceUrl, the
// dedup `raw.sourceId`, and every member story recorded in `raw.sources` —
// so a story that was background yesterday can't become today's headline.
async function loadUsedSources(pulseSlug: PulseSlug): Promise<PulseUsedSources | null> {
  const pulseArticle = getPulseDelegate();
  if (!pulseArticle) return null;

  const existing = await pulseArticle.findMany<PulseExistingRow>({
    where: { pulseSlug },
    select: { articleSlug: true, sourceUrl: true, raw: true },
  });

  const used: PulseUsedSources = { slugs: new Set(), sourceKeys: new Set() };
  for (const row of existing) {
    used.slugs.add(row.articleSlug);
    if (row.sourceUrl) used.sourceKeys.add(pulseSourceKey(row.sourceUrl));

    const raw = row.raw as Record<string, unknown> | null;
    if (typeof raw?.sourceId === 'string' && raw.sourceId) {
      used.sourceKeys.add(raw.sourceId.toLowerCase());
    }
    const sources = raw?.sources;
    if (Array.isArray(sources)) {
      for (const s of sources) {
        const url = (s as { url?: unknown })?.url;
        if (typeof url === 'string' && url) used.sourceKeys.add(pulseSourceKey(url));
      }
    }
  }
  return used;
}

function selectPulseJob(
  pulseSlug: PulseSlug,
  stories: RawStory[],
  used: PulseUsedSources,
): PulseJobPayload | null {
  const fresh = rankPulseClusters(stories, pulseSlug).filter(
    (c) => !c.members.some((m) => used.sourceKeys.has(pulseSourceKey(m.url))),
  );
  const [top, ...rest] = fresh;
  if (!top) return null;

  const primary = [
    top.representative,
    ...top.members.filter((m) => m !== top.representative),
  ].slice(0, MAX_PRIMARY_STORIES);
  const context = rest
    .slice(0, MAX_CONTEXT_CLUSTERS)
    .map((c) => c.representative)
    .slice(0, Math.max(0, MAX_TOTAL_STORIES - primary.length));

  return { pulseSlug, sourceId: pulseSourceKey(top.representative.url), primary, context };
}

// VERCEL_URL (injected by Vercel, no protocol) targets this exact deployment;
// SITE_URL is the local-dev fallback — same as enqueueDailyClusters in
// overview-service.ts.
function selfBaseUrl(): string | undefined {
  return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.SITE_URL;
}

// Called by /api/pulse/generate (daily cron).
export async function enqueuePulseCategories(): Promise<
  Record<PulseSlug, { enqueued: boolean; reason?: string }>
> {
  const storiesBySlug = await fetchPulseStoriesByCategory();
  const base = selfBaseUrl();

  const entries = await Promise.all(
    PULSE_SLUGS.map(async (pulseSlug) => {
      const stories = storiesBySlug[pulseSlug];
      try {
        const used = await loadUsedSources(pulseSlug);
        if (!used) return [pulseSlug, { enqueued: false, reason: 'db unavailable' }] as const;

        const job = selectPulseJob(pulseSlug, stories, used);
        if (!job) {
          console.warn(`[pulse-service] ${pulseSlug}: no fresh sources (${stories.length} stories)`);
          return [pulseSlug, { enqueued: false, reason: 'no fresh sources' }] as const;
        }

        // x-vercel-protection-bypass: VERCEL_URL sits behind Deployment
        // Protection, which QStash can't pass without the automation bypass.
        // timeout must exceed /api/pulse/process's runtime so QStash doesn't
        // retry (and double-bill RunPod) while the first attempt is running.
        await qstash.publishJSON({
          url: `${base}/api/pulse/process`,
          body: job,
          headers: { 'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET! },
          timeout: '295s',
        });
        console.log(
          `[pulse-service] ${pulseSlug}: ${stories.length} stories → enqueued "${job.primary[0].title}"`,
        );
        return [pulseSlug, { enqueued: true }] as const;
      } catch (err) {
        console.error(`[pulse-service] ${pulseSlug}: enqueue failed`, err);
        return [pulseSlug, { enqueued: false, reason: 'enqueue failed' }] as const;
      }
    }),
  );

  return Object.fromEntries(entries) as Record<PulseSlug, { enqueued: boolean; reason?: string }>;
}

// An 8B model regularly leaks markup into JSON string values ("**bold**",
// "### Heading", "- bullet", "<p>…</p>"). Left in, it would be escaped and
// shown as literal text inside the summary or a body section, so strip it
// before anything is stored. Paragraph breaks (blank lines) are preserved.
function cleanModelText(text: string): string {
  return text
    .replace(/<[^>]*>/g, ' ')
    .split(/\n\s*\n/)
    .map((para) =>
      para
        // A markdown heading is a stray label (our sections already have
        // headings), so drop the whole line rather than merging it into prose.
        .replace(/^\s{0,3}#{1,6}\s+.*$/gm, '')
        .replace(/^\s*(?:[-*•]|\d+[.)])\s+/gm, '')
        .replace(/\*\*|__|\*|`/g, '')
        .replace(/\s+/g, ' ')
        .replace(/\s+([.,;:!?])/g, '$1')
        .trim(),
    )
    .filter(Boolean)
    .join('\n\n');
}

// Title and summary render as plain text (<h1>, <p class="pulse-summary">),
// so they're a single line: no paragraph breaks, no wrapping quotes, and for
// the title no trailing period.
function cleanSingleLine(text: string): string {
  return cleanModelText(text).replace(/\s*\n\n\s*/g, ' ');
}

function cleanTitle(text: string): string {
  return cleanSingleLine(text)
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\.$/, '')
    .trim();
}

const cleanedText = z.string().transform(cleanModelText).pipe(z.string().min(1));

const PulseLlmOutputSchema = z.object({
  topic: z.string().transform(cleanSingleLine).pipe(z.string().min(1)),
  // Llama 8B occasionally drops "title" altogether; filled from "topic" below
  // rather than failing (and re-billing RunPod for) an otherwise complete article.
  title: z.string().optional().default('').transform(cleanTitle),
  slug: z.string().optional().default(''),
  summary: z.string().transform(cleanSingleLine).pipe(z.string().min(1)),
  topicAnalysis: cleanedText,
  perspectives: z
    .array(
      z.object({
        title: z.string().transform(cleanSingleLine).pipe(z.string().min(1)),
        text: cleanedText,
      }),
    )
    .length(3),
  macroNarrative1: cleanedText,
  macroNarrative2: cleanedText,
});

type PulseLlmOutput = z.infer<typeof PulseLlmOutputSchema>;

export function parsePulseLlmOutput(content: string): PulseLlmOutput {
  const out = PulseLlmOutputSchema.parse(JSON.parse(extractJson(content)));
  return { ...out, title: out.title || cleanTitle(out.topic) };
}

// Beats keep the four categories from converging on the same angle.
const CATEGORY_LENS: Record<PulseSlug, string> = {
  politics: 'domestic governance — legislative process, party dynamics, electoral consequence',
  economy: 'quantifiable economic impact — markets, fiscal and monetary policy, trade, labor',
  technology: 'technology and media — digital platforms, AI governance, cyber, media ecosystems',
  information:
    'geopolitics and national security — alliances, foreign-policy leverage, conflict, information warfare',
};

// Feed titles/snippets are third-party content — strip stray markup before
// it's interpolated into the prompt.
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

function formatStory(s: RawStory): string {
  return `- [${s.source}] ${stripHtml(s.title)}: ${stripHtml(s.snippet)}`;
}

function buildPulseMessages(job: PulseJobPayload) {
  const label = PULSE_CATEGORIES[job.pulseSlug].label;
  const system =
    `You are a senior political analyst writing a "${label}" Pulse briefing. ` +
    `Your beat is ${CATEGORY_LENS[job.pulseSlug]}; analyze the story strictly through that lens. ` +
    'Base every factual claim ONLY on the source snippets provided; do not invent figures, quotes, ' +
    'votes, or sources. When citing numbers, hedge them ("roughly") or attribute them to the outlet ' +
    'that reported them. NEVER name, quote, or attribute a claim to any organization, official, or ' +
    'publication (e.g. a chamber of commerce, a union, a state newspaper) unless it appears in the ' +
    'snippets — describe what a constituency argues ("export-oriented US businesses argue…") ' +
    'instead of inventing "according to X". ' +
    'Identify three distinct, competing perspectives on the PRIMARY story, each anchored to a named ' +
    'institutional, ideological, or geographic constituency (e.g. "House Republican leadership", ' +
    '"EU finance ministries"), then synthesize them into two opposing macro-narratives of matched ' +
    'length. Stay strictly neutral: use the same register for every side, and attribute any ' +
    "dismissive framing to the faction that holds it rather than stating it as fact. " +
    'The title must be specific to the story (a name, number, or event), must not use "Sparks ' +
    'Global" or similar "[verb] Global [noun]" constructions, and must not be a generic wire headline. ' +
    'Respond ONLY with raw JSON (no markdown fences, no text outside the object), with ALL of ' +
    'these keys, exactly: ' +
    '{"title": "8-14 word headline anchored on a concrete detail from the sources", ' +
    '"topic": "3-6 word plain noun phrase naming the story", ' +
    '"slug": "4-5 lowercase words joined by hyphens, letters only, no dates, months, years or weekdays", ' +
    '"summary": "2-3 sentences: the story and the two competing macro-narratives", ' +
    '"topicAnalysis": "1 paragraph: what happened and why it matters for this beat", ' +
    '"perspectives": [{"title": "name of the faction/viewpoint", "text": "80-110 words: its anchor, core thesis, and arguments"}, {...}, {...}], ' +
    '"macroNarrative1": "1 paragraph synthesis of the aligned viewpoints", ' +
    '"macroNarrative2": "1 paragraph synthesis of the opposing worldview, sharply contrasting the first"}. ' +
    '"perspectives" must contain exactly 3 items. Plain text only inside strings: no HTML, ' +
    'no markdown, no asterisks.';

  const user =
    `PRIMARY story (write about this):\n${job.primary.map(formatStory).join('\n')}` +
    (job.context.length
      ? `\n\nOther ${label} coverage today (background only — do not make it the subject):\n` +
        job.context.map(formatStory).join('\n')
      : '');

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Models sometimes echo the section label into the title ("Perspective 1: X").
function cleanPerspectiveTitle(title: string): string {
  return title.replace(/^\s*perspective\s*\d+\s*[:.\-–—]\s*/i, '').trim();
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('\n');
}

// Assembled here rather than asked of the model: an 8B model writing HTML
// inside a JSON string is the least reliable part of the output, and this
// keeps the exact section structure existing Pulse pages render.
export function buildPulseBodyHtml(out: PulseLlmOutput): string {
  const sections = [
    `<h2>Topic analysis</h2>\n${paragraphs(out.topicAnalysis)}`,
    ...out.perspectives.map(
      (p, i) =>
        `<h2>Perspective ${i + 1}: ${escapeHtml(cleanPerspectiveTitle(p.title))}</h2>\n${paragraphs(p.text)}`,
    ),
    `<h2>First macro-narrative</h2>\n${paragraphs(out.macroNarrative1)}`,
    `<h2>Second macro-narrative</h2>\n${paragraphs(out.macroNarrative2)}`,
  ];
  return sections.join('\n\n');
}

// The exact section structure Pulse pages render inside
// <article class="pulse-body pulse-body--html">. Checked before every write
// so a malformed generation fails the job (QStash retries) instead of
// publishing an article with a missing or reordered section.
const PULSE_BODY_HEADINGS: RegExp[] = [
  /^Topic analysis$/,
  /^Perspective 1: .+$/,
  /^Perspective 2: .+$/,
  /^Perspective 3: .+$/,
  /^First macro-narrative$/,
  /^Second macro-narrative$/,
];

export function assertPulseBodyStructure(html: string): void {
  const headings = [...html.matchAll(/<h2>([\s\S]*?)<\/h2>/g)].map((m) => m[1]);
  const ok =
    headings.length === PULSE_BODY_HEADINGS.length &&
    headings.every((h, i) => PULSE_BODY_HEADINGS[i].test(h));
  if (!ok) {
    throw new Error(`Pulse body has unexpected sections: ${JSON.stringify(headings)}`);
  }
  // pulse-body--html is only chosen when the body is detected as HTML, and
  // the page runs it through sanitizeArticleHtml — which must be a no-op here.
  if (!isHtmlFragment(html) || sanitizeArticleHtml(html) !== html) {
    throw new Error('Pulse body HTML would be altered by sanitizeArticleHtml');
  }
  if (/<p>\s*<\/p>/.test(html)) {
    throw new Error('Pulse body contains an empty section');
  }
}

function resolveArticleSlug(out: PulseLlmOutput, pulseSlug: PulseSlug): string {
  const modelSlug = out.slug || out.title;
  const strippedSlug = stripDateTokensFromSlug(modelSlug);
  if (strippedSlug !== canonicalizeSlug(modelSlug)) {
    console.warn(`[pulse-service] removed date-like slug tokens: "${modelSlug}" -> "${strippedSlug}"`);
  }
  const tokens = strippedSlug.split('-').filter(Boolean);
  if (tokens.length < 3) return regeneratePulseSlug(out.title, out.summary, pulseSlug);
  // Enforce the 4-5 word contract even if the model overshoots.
  return tokens.slice(0, 5).join('-');
}

function reviveStory(s: RawStory): RawStory {
  // Dates arrive as ISO strings after the QStash JSON round-trip.
  return { ...s, publishedAt: new Date(s.publishedAt) };
}

// Called by /api/pulse/process — exactly one category per invocation.
export async function processPulseCategory(payload: PulseJobPayload): Promise<{ created: number }> {
  const job: PulseJobPayload = {
    ...payload,
    primary: payload.primary.map(reviveStory),
    context: payload.context.map(reviveStory),
  };
  const { pulseSlug } = job;

  const pulseArticle = getPulseDelegate();
  if (!pulseArticle) return { created: 0 };

  // QStash retries (or a duplicate cron fire) must not write a second article
  // from the same source.
  const used = await loadUsedSources(pulseSlug);
  if (!used || used.sourceKeys.has(job.sourceId)) {
    console.log(`[pulse-service] ${pulseSlug}: source already used, skipping (${job.sourceId})`);
    return { created: 0 };
  }

  const content = await generateWithRunpod(buildPulseMessages(job), {
    maxTokens: PULSE_MAX_TOKENS,
  });
  const out = parsePulseLlmOutput(content);
  const body = buildPulseBodyHtml(out);
  assertPulseBodyStructure(body);

  // Keep pulse URLs date-free. If a slug collides, disambiguate with a
  // non-date suffix so the URL shape remains /pulse/{pulseSlug}/{articleSlug}.
  let articleSlug = resolveArticleSlug(out, pulseSlug);
  if (used.slugs.has(articleSlug) || (await isSlugTakenAcrossVerticals(articleSlug))) {
    let nextSlug = `${articleSlug}-${pulseSlug}`;
    let attempt = 2;
    while (used.slugs.has(nextSlug) || (await isSlugTakenAcrossVerticals(nextSlug))) {
      nextSlug = `${articleSlug}-${pulseSlug}-${attempt}`;
      attempt += 1;
    }
    articleSlug = nextSlug;
  }

  const sources = [...job.primary, ...job.context];
  const times = job.primary.map((s) => s.publishedAt.getTime()).filter((t) => !Number.isNaN(t));

  try {
    await pulseArticle.create({
      data: {
        pulseSlug,
        articleSlug,
        title: out.title,
        summary: out.summary,
        body,
        sourceUrl: job.primary[0]?.url || null,
        category: pulseSlug,
        observedStart: times.length ? new Date(Math.min(...times)) : null,
        observedEnd: times.length ? new Date(Math.max(...times)) : null,
        publishedAt: new Date(),
        raw: {
          sourceId: job.sourceId,
          model: RUNPOD_MODEL,
          topic: out.topic,
          sources: sources.map((s) => ({
            title: s.title,
            url: s.url,
            source: s.source,
            publishedAt: s.publishedAt.toISOString(),
          })),
        },
      },
    });
  } catch (err) {
    if (isUniqueConstraintError(err)) {
      console.warn(`[pulse-service] ${pulseSlug}: slug race on "${articleSlug}", skipping`);
      return { created: 0 };
    }
    throw err;
  }

  await notifyBing([`${SITE_URL}/pulse/${pulseSlug}/${articleSlug}`]);
  console.log(`[pulse-service] ${pulseSlug}: created "${articleSlug}"`);
  return { created: 1 };
}

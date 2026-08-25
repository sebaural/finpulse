import Anthropic from '@anthropic-ai/sdk';
import { getPrisma } from '@/lib/db';
import { notifyBing } from '@/lib/indexnow';
import { fetchPulseSummary } from '@/lib/gdelt';
import { PULSE_CATEGORIES, PULSE_SLUGS } from '@/lib/pulse-categories';
import {
  canonicalizeSlug,
  isSlugTakenAcrossVerticals,
  parseClaudeJson,
} from '@/lib/summary-pipeline';
import { SITE_URL } from '@/lib/seo';
import type { GdeltSummaryRow, PulseArticle, PulseSlug } from '@/types/pulse';

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

interface ClaudePulseResponse {
  title: string;
  slug: string;
  summary: string;
  body?: string;
  sourceUrl?: string;
  topic?: string;
}

interface RunTopic {
  topic: string;
  title: string;
}

interface PulseSourceShape {
  title: string;
  sourceUrl: string;
  summaryHint: string;
  observedStart: Date | null;
  observedEnd: Date | null;
  bucketKey: string;
  metricsHint: string;
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

function regeneratePulseSlug(source: PulseSourceShape, pulseSlug: PulseSlug): string {
  const tokens = canonicalizeSlug(
    `${source.title} ${source.summaryHint} ${pulseSlug} ${source.metricsHint}`,
  )
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

function toDateOrNull(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
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

function inferSourceUrl(row: GdeltSummaryRow): string {
  const candidates = [
    row.url,
    row.source_url,
    row.link,
    row.article_url,
    row.domain,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed;
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) {
      return `https://${trimmed}`;
    }
  }

  return '';
}

function inferTitle(row: GdeltSummaryRow, fallbackCategory: string): string {
  const candidates = [row.title, row.name, row.topic, row.label, row.event_name];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }
  return `${fallbackCategory} pulse update`;
}

function inferSummaryHint(row: GdeltSummaryRow): string {
  const candidates = [
    row.summary,
    row.description,
    row.snippet,
    row.topics,
    row.country,
    row.region,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
    if (Array.isArray(candidate)) {
      const first = candidate.find((item) => typeof item === 'string' && item.trim());
      if (typeof first === 'string') return first.trim();
    }
  }

  return '';
}

// GDELT summary rows returned with `group_by: date` carry no explicit
// timestamp field — the date bucket lives in `key` (e.g. "2026-07-02").
function getBucketDate(row: GdeltSummaryRow): Date | null {
  const candidates = [row.key, row.date, row.bucket, row.event_date];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T00:00:00Z` : trimmed;
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

// Compact, human-readable digest of the aggregate metrics on a date bucket so
// Claude has real signal to differentiate one day's briefing from the next.
function inferMetricsHint(row: GdeltSummaryRow): string {
  const parts: string[] = [];
  const metrics = (row.metrics ?? {}) as Record<string, { total?: unknown } | undefined>;
  const push = (label: string, value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) parts.push(`${label}: ${value}`);
  };

  push('events', row.event_count);
  push('articles', row.article_count ?? metrics.article_count?.total);
  push('fatalities', row.fatalities);
  push('avg significance', row.avg_significance);
  push('avg confidence', row.avg_confidence);
  push('avg market sensitivity', row.avg_market_sensitivity);
  push('avg systemic importance', row.avg_systemic_importance);

  return parts.join(', ');
}

function normalizePulseSource(row: GdeltSummaryRow, category: string): PulseSourceShape {
  const bucketDate = getBucketDate(row);
  const bucketKey =
    typeof row.key === 'string' && row.key.trim()
      ? row.key.trim()
      : bucketDate
        ? bucketDate.toISOString().slice(0, 10)
        : '';

  return {
    title: inferTitle(row, category),
    sourceUrl: inferSourceUrl(row),
    summaryHint: inferSummaryHint(row),
    observedStart: toDateOrNull(row.observed_start) ?? bucketDate,
    observedEnd: toDateOrNull(row.observed_end) ?? bucketDate,
    bucketKey,
    metricsHint: inferMetricsHint(row),
  };
}

function stableSourceKey(row: GdeltSummaryRow, normalized: PulseSourceShape): string {
  const idCandidates = [row.id, row.event_id, row.source_id, row.url, row.source_url];

  for (const id of idCandidates) {
    if (typeof id === 'string' && id.trim()) return id.trim().toLowerCase();
    if (typeof id === 'number') return String(id);
  }

  // Date-bucketed GDELT summaries have no per-event id or url, so keying on
  // title+url collapses to a per-category constant — after the first run every
  // row matches an existing key and nothing new is ever created. The date
  // bucket (`key`) is the stable per-day identity; syncPulseCategory already
  // scopes by category, so bucketKey alone is unique per (category, date).
  if (normalized.bucketKey) {
    return `${normalized.title.toLowerCase()}::${normalized.bucketKey.toLowerCase()}`;
  }

  return `${normalized.title.toLowerCase()}::${normalized.sourceUrl.toLowerCase()}`;
}

async function generatePulseArticleFromSource(
  source: PulseSourceShape,
  pulseSlug: PulseSlug,
  categoryLabel: string,
  otherTopicsThisRun: RunTopic[] = [],
): Promise<Required<Pick<ClaudePulseResponse, 'title' | 'slug' | 'summary' | 'topic'>> &
  Pick<ClaudePulseResponse, 'body' | 'sourceUrl'>> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey: anthropicKey });

  const prompt =
    `You are a Senior Political Analyst and Media Researcher specializing in global digital discourse. Your task is to analyze the current political landscape for the Pulse category "${categoryLabel}", identify the single top U.S. political topic driving the highest worldwide engagement right now through the specific lens of this category, and synthesize the discourse into two macro-summaries based on three distinct, opposing perspectives.\n\n` +
    `### CATEGORY LENS (READ FIRST)\n` +
    `Different categories will often be tempted to cover the same dominant news event on the same day. You must avoid this. Interpret "top topic" strictly through the lens implied by "${categoryLabel}":\n` +
    `- If the label suggests geopolitics/national security ("information"), prioritize the angle of international alliances, foreign-policy leverage, or global power balance — not the domestic legislative mechanics.\n` +
    `- If the label suggests domestic governance ("politics"), prioritize the angle of legislative process, party dynamics, or electoral consequence.\n` +
    `- If the label suggests markets/fiscal policy ("economy"), prioritize the angle of quantifiable economic impact — spending, taxation, markets, labor, trade.\n` +
    `- If the label suggests technology/media ("technology"), prioritize the angle of digital platforms, AI governance, media ecosystems, or information warfare.\n` +
    `- If "${categoryLabel}" doesn't map cleanly onto the above, infer its distinct beat and hold to it.\n` +
    `Even when one event (e.g., a major bill or crisis) is genuinely dominant across every beat, your job is to find the sub-facet, data point, or stakeholder conflict that is distinctly "${categoryLabel}"'s story — not to restate the same headline other categories would also reach for.\n\n` +
    (otherTopicsThisRun && otherTopicsThisRun.length
      ? `### TOPICS ALREADY COVERED THIS RUN (MUST NOT DUPLICATE)\n` +
        `The following topics and titles have already been generated for other categories today. Do not select the same primary topic as any of these. If your category's most obvious top story overlaps with one of these, you must either (a) select the next-most-significant distinct story for your category's lens, or (b) if the event is truly unavoidable for your beat, cover a materially different sub-facet of it — a different bill provision, different stakeholder, different geography, or different consequence — such that a reader would not perceive it as the same article. Your title's subject noun and structure must also differ from all of these:\n` +
        otherTopicsThisRun.map((t, i) => `${i + 1}. Topic: "${t.topic}" — Title: "${t.title}"`).join('\n') + `\n\n`
      : ``) +
    `Please execute this task using the following structured steps:\n\n` +
    `### STEP 1: TOPIC IDENTIFICATION\n` +
    `Identify the top U.S. political topic of today — filtered through the category lens above and checked against the "already covered" list — that is generating the most significant global engagement (e.g., on platforms like X, international news syndicates, and global policy forums). Briefly state the topic and the core event or catalyst behind it in 2-3 sentences, including any relevant data context (e.g., a CBO score, market reaction, or vote count) where genuinely applicable — hedged per Step 5.\n\n` +
    `### STEP 2: THE 3 OPPOSING PERSPECTIVES\n` +
    `Break down the global conversation into 3 distinct, prominent, and competing viewpoints driving the highest engagement. For each perspective, provide:\n` +
    `1. A descriptive title for the faction/viewpoint.\n` +
    `2. The specific institutional, ideological, or geographic anchor(s) that define this perspective (e.g., "House Republican leadership," "Senate Budget Committee moderates," "finance ministries of the Global South"). This anchor must be explicit and must demarcate the boundaries of the viewpoint so it cannot be confused with another perspective — do not let this collapse into a generic policy-position summary.\n` +
    `3. The core narrative or thesis statement, reflecting the priorities and worldview of the anchor(s).\n` +
    `4. The specific arguments or rhetoric they are using to drive engagement, including appeals to their constituency and references to relevant data points.\n\n` +
    `Ensure these 3 perspectives cover a diverse spectrum (e.g., domestic populist/nationalist, traditional institutionalist/fiscal hawk, global realist/Global South, adversarial/anti-Western, or neutral bystander) — chosen to fit whatever topic is identified in Step 1, not forced into a fixed template. Keep each perspective to a similar length (aim for 80-110 words of body text) so no viewpoint gets disproportionate space.\n\n` +
    `### STEP 3: THE TWO META-SUMMARIES\n` +
    `Synthesize those 3 perspectives into two distinct, overarching macro-narratives. These summaries should not just list the viewpoints, but seamlessly weave them into the two primary, competing realities currently clashing on the global stage.\n` +
    `Keep the two macro-narratives to matched length (within ~15% word count of each other).\n\n` +
    `### STEP 4: OBJECTIVITY AND LANGUAGE PARITY (CRITICAL)\n` +
    `Maintain strict analytical objectivity. Do not favor any perspective. Apply these concrete checks before finalizing:\n` +
    `- Use a symmetrical register across both macro-narratives. Do not describe one side's reasoning with credibility-coded words ("empirical," "data-driven," "evidence shows") while describing the other's only with emotion-coded words ("defiant," "triumphalist," "dismisses"). If you use an emotion word for one side, find the parallel emotional register for the other; if you cite data/evidence for one side's reasoning, cite the data/evidence the other side marshals too.\n` +
    `- Do not characterize any faction's opponents using that faction's own dismissive framing as if it were your narration (e.g., do not state as fact that a group is "ideologically hostile" — instead attribute that framing explicitly to the faction that holds it).\n` +
    `- Before writing the final output, mentally re-read both macro-narratives side by side and check: would a reader of either side conclude this treats their view fairly? If not, rebalance the language.\n\n` +
    `### STEP 5: FACTUAL HEDGING\n` +
    `When citing specific figures (dollar amounts, percentages, scores, vote counts), hedge appropriately unless you are highly confident the figure is accurate and current — use language like "estimated," "roughly," or "according to [named source]" rather than stating precise figures as bare fact. Do not invent a source attribution (e.g., "per the latest CBO score") unless you are confident such a score exists and says what you're citing. When describing engagement patterns on social media or elsewhere, frame these as illustrative characterizations of discourse style, not as measured/verified engagement data.\n\n` +
    `### STEP 6: TITLE REQUIREMENTS\n` +
    `Write a headline for this article that is specific to the actual topic identified in Step 1 — not a generic template.\n` +
    `- Do NOT use the phrase "Sparks Global," or any close variant of it (e.g., "Ignites Global," "Fuels Worldwide," "Triggers International," "Sets Off Global"). These connector-verb-plus-"Global" constructions are overused and banned.\n` +
    `- Do NOT use the pattern [Quoted proper noun/nickname] + [verb phrase describing a procedural stage, e.g. "Reaches the Senate Floor," "Heads to [Person]'s Desk," "Hits the Senate Floor"] + [colon] + [abstract subtitle]. This exact template is banned even if the wording varies, because it produces near-identical headlines across categories covering the same event.\n` +
    `- If your topic shares its central proper noun (a bill name, agency, person) with a title in the "already covered" list above, do not lead the title with that same proper noun in quotes. Lead with your category's distinct angle, stakeholder, or consequence instead.\n` +
    `- Do NOT structure the title as [Subject] + [connector verb] + "Global" + [abstract noun]. Vary the structure instead — options include a colon-led format ("Topic: What's Actually at Stake"), a direct statement, a named-entity-led format, or a question.\n` +
    `- Anchor the title in a concrete, specific detail from Step 1 (a name, number, bill, agency, or event) rather than an abstract category label like "Economic Realignment" or "Fiscal Direction."\n` +
    `- The title must read as distinct from a generic wire-service headline template — assume a reader will see this alongside titles from other categories, including the ones listed in "already covered" above, and it must not share a structural pattern or leading proper noun with any of them.\n\n` +
    `### CRITICAL OUTPUT RULE\n` +
    `Respond ONLY with a valid, raw JSON object using the exact key structure below. Do not wrap the JSON in Markdown code fences (e.g., do NOT use \`\`\`json). Do not include any intro, outro, or prose outside the JSON object. Escape all double quotes inside string values using standard JSON escaping (\\"). Do not include any keys other than the ones listed below.\n\n` +
    `{\n` +
    `  "topic": "3-6 word noun phrase naming the specific news topic/event identified in Step 1 (e.g. 'Senate reconciliation bill vote'). Internal use only for cross-category duplicate tracking — not shown to readers, so keep it plain and concrete, not headline-styled.",\n` +
    `  "title": "...",\n` +
    `  "slug": "url slug exactly 4-5 lowercase words joined by hyphens (max 4 hyphens total); letters and hyphens only; pick descriptive nouns or proper nouns that identify the angle; no stop words; DO NOT include any date component under any circumstances: no month names, years, quarters, days of week, or relative time words (examples: july, 2026, q3, today, weekly, monthly, daily); if a candidate word is date-related, replace it with a non-date noun before finalizing",\n` +
    `  "summary": "2-3 sentence concise summary of the top topic and the two competing macro-narratives",\n` +
    `  "body": "HTML fragment only. Do not use *, **, markdown bold, asterisks, bullets, or XML-style wrappers. Use semantic HTML and make each of the 3 Step 2 perspective titles a separate <h2> element. Keep the text beneath each heading in <p> blocks. Use this exact section order:\n\n<h2>Topic analysis</h2>\n<p>[Step 1 content]</p>\n\n<h2>Perspective 1: [title]</h2>\n<p>[anchor, core thesis, and rhetoric]</p>\n\n<h2>Perspective 2: [title]</h2>\n<p>[anchor, core thesis, and rhetoric]</p>\n\n<h2>Perspective 3: [title]</h2>\n<p>[anchor, core thesis, and rhetoric]</p>\n\n<h2>First macro-narrative</h2>\n<p>[1-paragraph synthesis of aligned viewpoints, focusing on underlying ideology, motivations, and global implications]</p>\n\n<h2>Second macro-narrative</h2>\n<p>[1-paragraph synthesis of opposing worldviews, sharply contrasting with the first macro-narrative to reveal the core ideological fault line]</p>"\n` +
    `}\n\n` +
    `Input source data:\n` +
    `Pulse slug: ${pulseSlug}\n` +
    `Title: ${source.title}\n` +
    `Date: ${source.bucketKey || 'N/A'}\n` +
    `Source URL: ${source.sourceUrl || 'N/A'}\n` +
    `Observed start: ${source.observedStart?.toISOString() ?? 'N/A'}\n` +
    `Observed end: ${source.observedEnd?.toISOString() ?? 'N/A'}\n` +
    `Aggregate signal metrics: ${source.metricsHint || 'N/A'}\n` +
    `Summary hint: ${source.summaryHint || 'N/A'}\n`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 6000,
    system:
      'You are a Senior Political Analyst and Media Researcher specializing in global digital discourse. Maintain strict analytical objectivity and return valid JSON only.',
    messages: [{ role: 'user', content: prompt }],
  });

  // Surface truncation explicitly instead of falling through to parseClaudeJson's
  // generic parse error, which was the only signal we had in production when
  // max_tokens cut the response off mid-object (see macro-service.ts's identical fix).
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Claude pulse response was truncated (stop_reason: max_tokens) — consider raising max_tokens');
  }

  const first = response.content[0];
  if (first.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const parsed = parseClaudeJson<ClaudePulseResponse>(first.text);
  const modelSlug = parsed.slug || parsed.title || source.title;
  const strippedSlug = stripDateTokensFromSlug(modelSlug);
  if (strippedSlug !== canonicalizeSlug(modelSlug)) {
    console.warn(`[pulse-service] removed date-like slug tokens: "${modelSlug}" -> "${strippedSlug}"`);
  }

  const slugTokens = strippedSlug.split('-').filter(Boolean);
  const slug = slugTokens.length < 3 ? regeneratePulseSlug(source, pulseSlug) : strippedSlug;

  return {
    title: parsed.title || source.title,
    slug,
    summary: parsed.summary || source.summaryHint || source.title,
    body: parsed.body || undefined,
    sourceUrl: parsed.sourceUrl || source.sourceUrl || undefined,
    topic: parsed.topic || parsed.title || source.title,
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

export async function syncPulseCategory(
  pulseSlug: PulseSlug,
  otherTopicsThisRun: RunTopic[] = [],
): Promise<{ created: number }> {
  const pulseArticle = getPulseDelegate();
  if (!pulseArticle) return { created: 0 };

  const config = PULSE_CATEGORIES[pulseSlug];
  const payload = await fetchPulseSummary({ category: config.gdeltCategory });
  const rawRows = Array.isArray(payload.data) ? payload.data : [];

  if (rawRows.length === 0) {
    console.warn(`[pulse-service] ${pulseSlug}: GDELT returned no rows`);
    return { created: 0 };
  }

  const existing = await pulseArticle.findMany<PulseExistingRow>({
    where: { pulseSlug },
    select: { articleSlug: true, sourceUrl: true, raw: true },
  });

  const existingSourceKeys = new Set<string>();
  const existingSlugs = new Set<string>();

  for (const row of existing) {
    existingSlugs.add(row.articleSlug);
    if (row.sourceUrl) existingSourceKeys.add(row.sourceUrl.toLowerCase());

    const raw = row.raw as Record<string, unknown> | null;
    const sourceId = raw?.sourceId;
    if (typeof sourceId === 'string' && sourceId) {
      existingSourceKeys.add(sourceId.toLowerCase());
    }
  }

  const seenBatchKeys = new Set<string>();
  let created = 0;
  const newUrls: string[] = [];

  for (const rawRow of rawRows) {
    const normalized = normalizePulseSource(rawRow, config.gdeltCategory);
    const sourceKey = stableSourceKey(rawRow, normalized);

    if (!sourceKey || seenBatchKeys.has(sourceKey) || existingSourceKeys.has(sourceKey)) {
      continue;
    }

    seenBatchKeys.add(sourceKey);

    const generated = await generatePulseArticleFromSource(
      normalized,
      pulseSlug,
      config.label,
      otherTopicsThisRun,
    );
    if (!generated.slug) {
      continue;
    }
    // Shared across categories in this run (see runDailyPulsePipeline) so later
    // categories' prompts know what earlier ones already covered.
    otherTopicsThisRun.push({ topic: generated.topic, title: generated.title });

    // Keep pulse URLs date-free. If a slug collides, disambiguate with a
    // non-date suffix so the URL shape remains /pulse/{pulseSlug}/{articleSlug}.
    let articleSlug = generated.slug;
    if (existingSlugs.has(articleSlug) || (await isSlugTakenAcrossVerticals(articleSlug))) {
      let nextSlug = `${articleSlug}-${pulseSlug}`;
      let attempt = 2;
      while (existingSlugs.has(nextSlug) || (await isSlugTakenAcrossVerticals(nextSlug))) {
        nextSlug = `${articleSlug}-${pulseSlug}-${attempt}`;
        attempt += 1;
      }
      articleSlug = nextSlug;
    }

    try {
      await pulseArticle.create({
        data: {
          pulseSlug,
          articleSlug,
          title: generated.title,
          summary: generated.summary,
          body: generated.body,
          category: config.gdeltCategory,
          observedStart: normalized.observedStart,
          observedEnd: normalized.observedEnd,
          publishedAt: new Date(),
          raw: {
            sourceId: sourceKey,
            row: rawRow,
          },
        },
      });

      existingSlugs.add(articleSlug);
      existingSourceKeys.add(sourceKey);
      newUrls.push(`${SITE_URL}/pulse/${pulseSlug}/${articleSlug}`);
      created += 1;
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        existingSourceKeys.add(sourceKey);
        continue;
      }
      throw err;
    }
  }

  if (newUrls.length > 0) {
    await notifyBing(newUrls);
  }

  console.log(`[pulse-service] ${pulseSlug}: ${rawRows.length} source rows → ${created} created`);

  return { created };
}

// Pulse sources from GDELT, which is capped at 100 query units/month on the
// free plan. Four categories run per invocation, so a daily cadence is ~120
// QU/month — over the cap, which silently zeros out generation once exhausted.
// Running pulse every other day (~15 days × 4 ≈ 60 QU/month) keeps it under
// budget. Parity is on the epoch day number so it alternates cleanly across
// month boundaries (unlike a cron `*/2` day-of-month, which double-fires at the
// 31st→1st rollover). Enforced here (not by the caller) so it holds regardless
// of which cron/route invokes runDailyPulsePipeline.
function shouldRunPulseToday(): boolean {
  return Math.floor(Date.now() / 86_400_000) % 2 === 0;
}

// Seeds cross-category dedup for categories that aren't part of *this*
// invocation's group (see PULSE_GROUPS below) by reading back what other
// groups already published today, rather than only tracking it in-memory.
// Without this, splitting the run across multiple invocations would blind
// each group to what the other group already covered.
async function getTodaysOtherCategoryTopics(excludeSlugs: PulseSlug[]): Promise<RunTopic[]> {
  const pulseArticle = getPulseDelegate();
  if (!pulseArticle) return [];

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);

  try {
    const rows = await pulseArticle.findMany<{ pulseSlug: string; title: string }>({
      where: { publishedAt: { gte: startOfDay }, pulseSlug: { notIn: excludeSlugs } },
      select: { pulseSlug: true, title: true },
    });
    return rows.map((row) => ({ topic: row.title, title: row.title }));
  } catch (err) {
    console.error('[pulse-service] failed to load today\'s cross-group topics', err);
    return [];
  }
}

// Four categories run sequentially per invocation (see syncPulseCategory
// comments) so each category's prompt can see what earlier categories already
// covered. On Vercel Hobby, maxDuration is hard-capped at 300s and four
// sequential GDELT-fetch + Claude-opus rounds routinely run ~230-250s for the
// first three alone — the fourth in iteration order was reliably starved and
// killed mid-flight before it could write anything (this is what silently
// zeroed out the "strategic" category — now named "information" — from Aug 3
// onward). Splitting the run
// into two groups of two categories, invoked an hour apart by separate cron
// entries (see vercel.json — Hobby cron precision is only accurate to the
// hour, so a few-minutes stagger wouldn't be reliable), keeps each invocation
// comfortably under budget. `group` selects which half runs; omitted
// (manual/local trigger) runs all four sequentially as before.
const PULSE_GROUPS: Record<1 | 2, PulseSlug[]> = {
  1: ['economy', 'technology'],
  2: ['politics', 'information'],
};

export async function runDailyPulsePipeline(
  group?: 1 | 2,
): Promise<Record<PulseSlug, { created: number }>> {
  const slugs = group ? PULSE_GROUPS[group] : (Object.keys(PULSE_CATEGORIES) as PulseSlug[]);
  const allSlugs = Object.keys(PULSE_CATEGORIES) as PulseSlug[];

  if (!shouldRunPulseToday()) {
    console.log('[pulse-service] skipped today — runs every other day (GDELT quota budget)');
    return Object.fromEntries(allSlugs.map((slug) => [slug, { created: 0 }])) as Record<
      PulseSlug,
      { created: number }
    >;
  }

  // otherTopicsThisRun accumulates across this invocation's categories, seeded
  // with whatever the other group already published today (empty on a
  // full/manual run, or on group 1 since it runs first).
  const otherTopicsThisRun: RunTopic[] = await getTodaysOtherCategoryTopics(slugs);
  const resultsBySlug = new Map<PulseSlug, { created: number }>();
  for (const slug of slugs) {
    try {
      resultsBySlug.set(slug, await syncPulseCategory(slug, otherTopicsThisRun));
    } catch (err) {
      console.error(`[pulse-service] ${slug} pipeline failed`, err);
      resultsBySlug.set(slug, { created: 0 });
    }
  }

  return Object.fromEntries(
    allSlugs.map((slug) => [slug, resultsBySlug.get(slug) ?? { created: 0 }]),
  ) as Record<PulseSlug, { created: number }>;
}

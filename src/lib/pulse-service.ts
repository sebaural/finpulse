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
  schemaMarkup?: Record<string, unknown>;
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
): Promise<ClaudePulseResponse> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  const client = new Anthropic({ apiKey: anthropicKey });

  const prompt =
    `You are a Senior Political Analyst and Media Researcher specializing in global digital discourse. Your task is to analyze the current political landscape for the Pulse category "${categoryLabel}", identify the single top U.S. political topic driving the highest worldwide engagement right now, and synthesize the discourse into two macro-summaries based on three distinct, opposing perspectives.\n\n` +
    `Please execute this task using the following structured steps:\n\n` +
    `### STEP 1: TOPIC IDENTIFICATION\n` +
    `Identify the top U.S. political topic of today that is generating the most significant global engagement (e.g., on platforms like X, international news syndicates, and global policy forums). Briefly state the topic and the core event or catalyst behind it in 2-3 sentences.\n\n` +
    `### STEP 2: THE 3 OPPOSING PERSPECTIVES\n` +
    `Break down the global conversation into 3 distinct, prominent, and competing viewpoints driving the highest engagement. For each perspective, provide:\n` +
    `1. A descriptive title for the faction/viewpoint.\n` +
    `2. The core narrative or thesis statement.\n` +
    `3. The specific arguments or rhetoric they are using to drive engagement.\n\n` +
    `Ensure these 3 perspectives cover a diverse spectrum (e.g., domestic populist, traditional institutionalist, global realist, adversarial/anti-Western, or neutral bystander/Global South).\n\n` +
    `### STEP 3: THE TWO META-SUMMARIES\n` +
    `Synthesize those 3 perspectives into two distinct, overarching macro-narratives. These summaries should not just list the viewpoints, but seamlessly weave them into the two primary, competing realities currently clashing on the global stage.\n\n` +
    `Maintain strict analytical objectivity. Do not favor any perspective; instead, focus on accurately capturing the emotional weight, logical frameworks, and geopolitical drivers behind each faction's engagement.\n\n` +
    `### STEP 4: TITLE REQUIREMENTS\n` +
    `Write a headline for this article that is specific to the actual topic identified in Step 1 — not a generic template.\n` +
    `- Do NOT use the phrase "Sparks Global," or any close variant of it (e.g., "Ignites Global," "Fuels Worldwide," "Triggers International," "Sets Off Global"). These connector-verb-plus-"Global" constructions are overused and banned.\n` +
    `- Do NOT structure the title as [Subject] + [connector verb] + "Global" + [abstract noun]. Vary the structure instead — options include a colon-led format ("Topic: What's Actually at Stake"), a direct statement, a named-entity-led format, or a question.\n` +
    `- Anchor the title in a concrete, specific detail from Step 1 (a name, number, bill, agency, or event) rather than an abstract category label like "Economic Realignment" or "Fiscal Direction."\n` +
    `- The title must read as distinct from a generic wire-service headline template — assume a reader will see this alongside titles from other categories, and it should not share a structural pattern with them.\n\n` +
    `### STEP 5: JSON-LD SCHEMA MARKUP\n` +
    `Generate a valid JSON-LD structured data object using schema.org's AnalysisNewsArticle type. This is a subtype of NewsArticle intended to signal that the piece is analytical/interpretive rather than straight reporting. Requirements:\n` +
    `- "@context" must be "https://schema.org" and "@type" must be "AnalysisNewsArticle".\n` +
    `- "headline" must match the title generated in Step 4 exactly (schema.org headlines should stay under ~110 characters; if the title is longer, keep this field verbatim anyway and do not truncate silently — instead ensure Step 4's title respects this limit).\n` +
    `- "description" should mirror the "summary" field content (2-3 sentences).\n` +
    `- "datePublished" and "dateModified" should use the Observed end value in ISO 8601 format (fall back to current ISO timestamp if unavailable).\n` +
    `- "author" must be an object of "@type": "Organization" with "name" set to a sensible publication/brand name inferred from context (or "Pulse" if none is available).\n` +
    `- "publisher" must be an object of "@type": "Organization" with "name" and a "logo" object of "@type": "ImageObject" (use placeholder "url" values if no real asset is known).\n` +
    `- "mainEntityOfPage" must be an object of "@type": "WebPage" with "@id" set to the sourceUrl if available, otherwise omit this field.\n` +
    `- "about" should be an array of one or more "@type": "Thing" objects naming the key entities/topics identified in Step 1 (e.g., named people, agencies, bills).\n` +
    `- Include "keywords" as a comma-separated string derived from the slug words and Step 2 perspective titles.\n` +
    `- Do not include markdown, comments, or trailing commas — this must be strictly parseable JSON when extracted as its own object.\n\n` +
    `Respond with JSON only using this exact shape:\n` +
    `{\n` +
    `  "title": "...",\n` +
    `  "slug": "url slug exactly 4-5 lowercase words joined by hyphens (max 4 hyphens total); letters and hyphens only; pick descriptive nouns or proper nouns that identify the angle; no stop words; DO NOT include any date component under any circumstances: no month names, years, quarters, days of week, or relative time words (examples: july, 2026, q3, today, weekly, monthly, daily); if a candidate word is date-related, replace it with a non-date noun before finalizing",\n` +
    `  "summary": "2-3 sentence concise summary of the top topic and the two competing macro-narratives",\n` +
    `  "body": "HTML fragment only. Do not use *, **, markdown bold, asterisks, bullets, or XML-style wrappers. Use semantic HTML and make each of the 3 Step 2 perspective titles a separate <h2> element. Keep the text beneath each heading in <p> blocks. Use this exact section order:\n\n<h2>Topic analysis</h2>\n<p>[Step 1 content]</p>\n\n<h2>Perspective 1: [title]</h2>\n<p>[core thesis and rhetoric]</p>\n\n<h2>Perspective 2: [title]</h2>\n<p>[core thesis and rhetoric]</p>\n\n<h2>Perspective 3: [title]</h2>\n<p>[core thesis and rhetoric]</p>\n\n<h2>First macro-narrative</h2>\n<p>[1-paragraph synthesis of aligned viewpoints, focusing on underlying ideology, motivations, and global implications]</p>\n\n<h2>Second macro-narrative</h2>\n<p>[1-paragraph synthesis of opposing worldviews, sharply contrasting with the first macro-narrative to reveal the core ideological fault line]</p>",\n` +
    `  "sourceUrl": "source URL if available",\n` +
    `  "schemaMarkup": { JSON-LD object as specified in STEP 5, valid AnalysisNewsArticle schema.org markup, returned as a nested JSON object (not a stringified string) }\n` +
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
    max_tokens: 3200,
    system:
      'You are a Senior Political Analyst and Media Researcher specializing in global digital discourse. Maintain strict analytical objectivity and return valid JSON only.',
    messages: [{ role: 'user', content: prompt }],
  });

  const first = response.content[0];
  if (!first || first.type !== 'text') {
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
  const schemaMarkup = isObjectRecord(parsed.schemaMarkup) ? parsed.schemaMarkup : undefined;

  return {
    title: parsed.title || source.title,
    slug,
    summary: parsed.summary || source.summaryHint || source.title,
    body: parsed.body || undefined,
    sourceUrl: parsed.sourceUrl || source.sourceUrl || undefined,
    schemaMarkup,
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

export async function syncPulseCategory(pulseSlug: PulseSlug): Promise<{ created: number }> {
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

    const generated = await generatePulseArticleFromSource(normalized, pulseSlug, config.label);
    if (!generated.slug) {
      continue;
    }

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
          sourceUrl: generated.sourceUrl || normalized.sourceUrl || null,
          category: config.gdeltCategory,
          observedStart: normalized.observedStart,
          observedEnd: normalized.observedEnd,
          publishedAt: new Date(),
          raw: {
            sourceId: sourceKey,
            row: rawRow,
            schemaMarkup: generated.schemaMarkup ?? null,
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

export async function runDailyPulsePipeline(): Promise<Record<PulseSlug, { created: number }>> {
  const slugs = Object.keys(PULSE_CATEGORIES) as PulseSlug[];

  // Fault-isolate per category: a single category's GDELT/Claude failure must
  // not reject the whole pulse pipeline and zero out the categories that would
  // otherwise have succeeded.
  const settled = await Promise.allSettled(slugs.map((slug) => syncPulseCategory(slug)));
  const results = settled.map((outcome, i) => {
    if (outcome.status === 'fulfilled') return outcome.value;
    console.error(`[pulse-service] ${slugs[i]} pipeline failed`, outcome.reason);
    return { created: 0 };
  });

  return Object.fromEntries(slugs.map((slug, i) => [slug, results[i]])) as Record<
    PulseSlug,
    { created: number }
  >;
}

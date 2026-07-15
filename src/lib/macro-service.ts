// src/lib/macro-service.ts
//
// Persistence + generation for "The Macro Landscape".
//
// Unlike the markets/pulse/tech/geopolitics verticals, Macro Landscape has NO
// feed-ingestion step: it does not read feeds.json, gdelt, feedsStore, dedup, or
// services/news. Its only inputs each run are the generation prompt and the
// model's own live web search (enabled on the Claude call). See
// macro-landscape-feature-build-prompt.md.

import Anthropic from '@anthropic-ai/sdk';
import { getPrisma } from './db';
import { parseClaudeJson } from '@/lib/summary-pipeline';
import { sanitizePulseHtml } from '@/lib/pulse-html';
import { buildMacroPrompt, MACRO_SYSTEM_PROMPT } from '@/lib/macro-prompt';
import type { AdjacentMacroArticleInfo, MacroArticle, MacroArticleResponse } from '@/types/macro';

type MacroRow = {
  id: string;
  slug: string;
  title: string;
  publishedDate: Date;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

/** A DATE column round-trips through Prisma as a Date at UTC midnight. */
function dateColumnToIso(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** 'YYYY-MM-DD' -> Date at UTC midnight, so DATE storage is stable across re-reads. */
function isoToDateColumn(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Today's calendar date in America/New_York as 'YYYY-MM-DD'. */
export function todayInNewYork(): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function mapRow(row: MacroRow): MacroArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    publishedDate: dateColumnToIso(row.publishedDate),
    body: row.body,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toAdjacent(row: MacroRow | null): AdjacentMacroArticleInfo | null {
  if (!row) return null;
  return { slug: row.slug, publishedDate: dateColumnToIso(row.publishedDate) };
}

// ---------------------------------------------------------------------------
// Queries — single-item, not list (the block always shows exactly one entry)
// ---------------------------------------------------------------------------

/** The most recently published entry for embedded surfaces (home + live feed). */
export async function getLatestMacroArticle(): Promise<MacroArticle | null> {
  try {
    const prisma = getPrisma();
    const row = await prisma.macroArticle.findFirst({
      orderBy: { publishedDate: 'desc' },
    });
    return row ? mapRow(row) : null;
  } catch (error) {
    console.error('[macro-service] failed to load latest article', error);
    return null;
  }
}

/**
 * The entry immediately before/after the given date. `previous` steps to the
 * next-older day; `next` steps forward and never returns something newer than
 * the latest entry (it queries `publishedDate >`, so at the latest entry there
 * is nothing to return). Returns null when there is no adjacent entry.
 */
export async function getAdjacentMacroArticle(
  publishedDate: string,
  direction: 'previous' | 'next',
): Promise<AdjacentMacroArticleInfo | null> {
  try {
    const prisma = getPrisma();
    const pivot = isoToDateColumn(publishedDate);
    const row = await prisma.macroArticle.findFirst({
      where:
        direction === 'previous'
          ? { publishedDate: { lt: pivot } }
          : { publishedDate: { gt: pivot } },
      orderBy: { publishedDate: direction === 'previous' ? 'desc' : 'asc' },
    });
    return toAdjacent(row);
  } catch (error) {
    console.error('[macro-service] failed to load adjacent article', error);
    return null;
  }
}

/** Single-article fetch by slug (permalinks + resolving a pager step). */
export async function getMacroArticleBySlug(slug: string): Promise<MacroArticle | null> {
  try {
    const prisma = getPrisma();
    const row = await prisma.macroArticle.findUnique({ where: { slug } });
    return row ? mapRow(row) : null;
  } catch (error) {
    console.error('[macro-service] failed to load article by slug', error);
    return null;
  }
}

/** Single-article fetch by publishedDate (deep-linked `?date=`). */
export async function getMacroArticleByDate(publishedDate: string): Promise<MacroArticle | null> {
  try {
    const prisma = getPrisma();
    const row = await prisma.macroArticle.findUnique({
      where: { publishedDate: isoToDateColumn(publishedDate) },
    });
    return row ? mapRow(row) : null;
  } catch (error) {
    console.error('[macro-service] failed to load article by date', error);
    return null;
  }
}

/**
 * Assemble the single-item response shape (article + prev/next adjacency) that
 * both the /api/macro/articles route and the server pages render. `next` is null
 * once the given article is already the latest entry.
 */
export async function buildMacroResponse(article: MacroArticle): Promise<MacroArticleResponse> {
  const latest = await getLatestMacroArticle();
  const isLatest = !!latest && latest.publishedDate === article.publishedDate;

  const [previous, next] = await Promise.all([
    getAdjacentMacroArticle(article.publishedDate, 'previous'),
    isLatest ? Promise.resolve(null) : getAdjacentMacroArticle(article.publishedDate, 'next'),
  ]);

  return {
    article: {
      title: article.title,
      slug: article.slug,
      publishedDate: article.publishedDate,
      body: article.body,
    },
    previous,
    next,
  };
}

/** Latest entry assembled as a response (empty article when the archive is empty). */
export async function getLatestMacroResponse(): Promise<MacroArticleResponse> {
  const latest = await getLatestMacroArticle();
  if (!latest) return { article: null, previous: null, next: null };
  return buildMacroResponse(latest);
}

// ---------------------------------------------------------------------------
// Write — create once per publishedDate (same-day re-runs do not update)
// ---------------------------------------------------------------------------

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'P2002'
  );
}

export async function createMacroArticleIfMissing(data: {
  title: string;
  slug: string;
  publishedDate: string;
  body: string;
}): Promise<MacroArticle> {
  const prisma = getPrisma();
  const publishedDate = isoToDateColumn(data.publishedDate);

  // Immutable rule: once a row exists for this NY date, never update it.
  const existing = await prisma.macroArticle.findUnique({ where: { publishedDate } });
  if (existing) return mapRow(existing);

  const payload = {
    title: data.title,
    slug: data.slug,
    publishedDate,
    body: data.body,
  };

  try {
    const row = await prisma.macroArticle.create({ data: payload });
    return mapRow(row);
  } catch (error) {
    // Concurrent cron invocations can race on the same publishedDate unique key.
    // On conflict, return the already-created row and keep it unchanged.
    if (isUniqueConstraintError(error)) {
      const raced = await prisma.macroArticle.findUnique({ where: { publishedDate } });
      if (raced) return mapRow(raced);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Generation — Claude Opus 4.6 with live web search (no feed ingestion)
// ---------------------------------------------------------------------------

interface ClaudeMacroResponse {
  title: string;
  slug: string;
  publishedDate: string;
  body: string;
}

/** Strip markdown code fences the way parseClaudeJson does, for candidacy checks. */
function stripFences(text: string): string {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/, '')
      .trim();
  }
  return cleaned;
}

function extractJsonText(content: Anthropic.Messages.ContentBlock[]): string {
  // The final answer is a text block; web search / thinking blocks precede it.
  // Walk from the end and return the last text block that actually holds a JSON
  // object. Taking the *last* text block unconditionally is fragile: the model
  // sometimes ends its turn with a trailing commentary block ("Let me now …")
  // AFTER the JSON, which would otherwise be parsed and fail.
  for (let i = content.length - 1; i >= 0; i--) {
    const block = content[i];
    if (block.type === 'text' && stripFences(block.text).startsWith('{')) {
      return block.text;
    }
  }
  throw new Error('No JSON object found in Claude response text blocks');
}

export async function generateMacroArticle(): Promise<{
  title: string;
  slug: string;
  publishedDate: string;
  body: string;
}> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set');

  const client = new Anthropic({ apiKey: anthropicKey });
  const publishDate = todayInNewYork();

  const messages: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: buildMacroPrompt(publishDate) },
  ];

  // web_search_20260209 (dynamic filtering) is supported on Claude Opus 4.6.
  // The server runs its own search loop; if it hits the iteration cap it returns
  // stop_reason 'pause_turn' and we re-send to resume.
  const tools = [
    { type: 'web_search_20260209', name: 'web_search', max_uses: 8 },
  ] as unknown as Anthropic.Messages.ToolUnion[];

  let response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 8000,
    system: MACRO_SYSTEM_PROMPT,
    tools,
    messages,
  });

  let guard = 0;
  while (response.stop_reason === 'pause_turn' && guard < 5) {
    messages.push({ role: 'assistant', content: response.content });
    response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 8000,
      system: MACRO_SYSTEM_PROMPT,
      tools,
      messages,
    });
    guard += 1;
  }

  const parsed = parseClaudeJson<ClaudeMacroResponse>(extractJsonText(response.content));

  // Validate the four keys are present and body is non-empty HTML.
  const missing = (['title', 'slug', 'publishedDate', 'body'] as const).filter(
    (k) => !parsed[k] || typeof parsed[k] !== 'string' || !parsed[k].trim(),
  );
  if (missing.length > 0) {
    throw new Error(`Macro generation missing required key(s): ${missing.join(', ')}`);
  }

  // The publish date is authoritative on our side — coerce to the date we asked
  // for, and log if the model's slug doesn't match it (per Downstream Handling).
  const expectedSlug = `macro-landscape-${publishDate}`;
  if (parsed.slug !== expectedSlug) {
    console.warn(
      `[macro-service] slug "${parsed.slug}" does not match publishedDate ${publishDate}; using "${expectedSlug}"`,
    );
  }
  if (parsed.publishedDate !== publishDate) {
    console.warn(
      `[macro-service] model publishedDate "${parsed.publishedDate}" != requested ${publishDate}; coercing`,
    );
  }

  const body = sanitizePulseHtml(parsed.body).trim();
  if (!body) throw new Error('Macro generation produced an empty body after sanitization');

  return {
    title: parsed.title.trim(),
    slug: expectedSlug,
    publishedDate: publishDate,
    body,
  };
}

/**
 * Cron entry point: generate today's entry once.
 * If a row for today's NY date already exists, return it without re-generating.
 */
export async function runDailyMacroPipeline(): Promise<MacroArticle> {
  const today = todayInNewYork();
  const existing = await getMacroArticleByDate(today);
  if (existing) return existing;

  const generated = await generateMacroArticle();
  return createMacroArticleIfMissing(generated);
}

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
  findMany: (...args: any[]) => Promise<any[]>;
  findUnique: (...args: any[]) => Promise<any | null>;
  upsert: (...args: any[]) => Promise<any>;
}

function getPulseDelegate(): PulseArticleDelegateLike | null {
  const prisma = getPrisma() as unknown as { pulseArticle?: PulseArticleDelegateLike };
  if (!prisma.pulseArticle) {
    console.error(
      '[pulse-service] prisma.pulseArticle is unavailable. Regenerate Prisma client and restart the server.',
    );
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
}

interface PulseSourceShape {
  title: string;
  sourceUrl: string;
  summaryHint: string;
  observedStart: Date | null;
  observedEnd: Date | null;
}

function toDateOrNull(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toPulseArticle(row: {
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
}): PulseArticle {
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

function normalizePulseSource(row: GdeltSummaryRow, category: string): PulseSourceShape {
  return {
    title: inferTitle(row, category),
    sourceUrl: inferSourceUrl(row),
    summaryHint: inferSummaryHint(row),
    observedStart: toDateOrNull(row.observed_start),
    observedEnd: toDateOrNull(row.observed_end),
  };
}

function stableSourceKey(row: GdeltSummaryRow, normalized: PulseSourceShape): string {
  const idCandidates = [row.id, row.event_id, row.source_id, row.url, row.source_url];

  for (const id of idCandidates) {
    if (typeof id === 'string' && id.trim()) return id.trim().toLowerCase();
    if (typeof id === 'number') return String(id);
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
    `Generate a concise macro intelligence briefing for the Pulse category "${categoryLabel}".\n` +
    `Respond with JSON only using this exact shape:\n` +
    `{\n` +
    `  "title": "...",\n` +
    `  "slug": "4-5 word lowercase slug with hyphens",\n` +
    `  "summary": "2-3 sentence concise summary",\n` +
    `  "body": "4-6 paragraph briefing with strategic context",\n` +
    `  "sourceUrl": "source URL if available"\n` +
    `}\n\n` +
    `Input source data:\n` +
    `Pulse slug: ${pulseSlug}\n` +
    `Title: ${source.title}\n` +
    `Source URL: ${source.sourceUrl || 'N/A'}\n` +
    `Observed start: ${source.observedStart?.toISOString() ?? 'N/A'}\n` +
    `Observed end: ${source.observedEnd?.toISOString() ?? 'N/A'}\n` +
    `Summary hint: ${source.summaryHint || 'N/A'}\n`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1600,
    system:
      'You are a macro intelligence editor. Write neutral, high-signal briefings and return valid JSON only.',
    messages: [{ role: 'user', content: prompt }],
  });

  const first = response.content[0];
  if (first.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const parsed = parseClaudeJson<ClaudePulseResponse>(first.text);
  const slug = canonicalizeSlug(parsed.slug || parsed.title || source.title);

  return {
    title: parsed.title || source.title,
    slug,
    summary: parsed.summary || source.summaryHint || source.title,
    body: parsed.body || null,
    sourceUrl: parsed.sourceUrl || source.sourceUrl || null,
  };
}

export async function getPulseArticles(pulseSlug: PulseSlug): Promise<PulseArticle[]> {
  try {
    const pulseArticle = getPulseDelegate();
    if (!pulseArticle) return [];

    const rows = await pulseArticle.findMany({
      where: { pulseSlug },
      orderBy: [{ observedStart: 'desc' }, { createdAt: 'desc' }],
    });
    return rows.map(toPulseArticle);
  } catch (error) {
    console.error('[pulse-service] failed to load pulse articles', error);
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

    const row = await pulseArticle.findUnique({
      where: { pulseSlug_articleSlug: { pulseSlug, articleSlug } },
    });
    return row ? toPulseArticle(row) : null;
  } catch (error) {
    console.error('[pulse-service] failed to load pulse article', error);
    return null;
  }
}

export async function getLatestArticlePerCategory(): Promise<Record<PulseSlug, PulseArticle | null>> {
  const entries = await Promise.all(
    PULSE_SLUGS.map(async (slug) => {
      const [latest] = await getPulseArticles(slug);
      return [slug, latest ?? null] as const;
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
    return { created: 0 };
  }

  const existing = await pulseArticle.findMany({
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

    let articleSlug = generated.slug;
    if (existingSlugs.has(articleSlug) || (await isSlugTakenAcrossVerticals(articleSlug))) {
      articleSlug = `${generated.slug}-${pulseSlug}`;
    }

    const upserted = await pulseArticle.upsert({
      where: { pulseSlug_articleSlug: { pulseSlug, articleSlug } },
      create: {
        pulseSlug,
        articleSlug,
        title: generated.title,
        summary: generated.summary,
        body: generated.body,
        sourceUrl: generated.sourceUrl,
        category: config.gdeltCategory,
        observedStart: normalized.observedStart,
        observedEnd: normalized.observedEnd,
        publishedAt: new Date(),
        raw: {
          sourceId: sourceKey,
          row: rawRow,
        },
      },
      update: {
        title: generated.title,
        summary: generated.summary,
        body: generated.body,
        sourceUrl: generated.sourceUrl,
        raw: {
          sourceId: sourceKey,
          row: rawRow,
        },
      },
    });

    existingSlugs.add(articleSlug);
    existingSourceKeys.add(sourceKey);
    if (upserted.articleSlug) {
      newUrls.push(`${SITE_URL}/pulse/${pulseSlug}/${upserted.articleSlug}`);
    }
    created += 1;
  }

  if (newUrls.length > 0) {
    await notifyBing(newUrls);
  }

  return { created };
}

export async function syncAllPulseCategories(): Promise<Record<PulseSlug, { created: number }>> {
  const results = await Promise.all(PULSE_SLUGS.map((slug) => syncPulseCategory(slug)));
  return Object.fromEntries(PULSE_SLUGS.map((slug, i) => [slug, results[i]])) as Record<
    PulseSlug,
    { created: number }
  >;
}

export async function runDailyPulsePipeline(): Promise<Record<PulseSlug, { created: number }>> {
  return syncAllPulseCategories();
}

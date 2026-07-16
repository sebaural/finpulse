export type PulseSlug = 'economy' | 'information' | 'politics' | 'strategic';

export interface PulseCategoryConfig {
  pulseSlug: PulseSlug;
  label: string;
  gdeltCategory: string;
}

export interface PulseArticleParams {
  pulseSlug: PulseSlug;
  articleSlug: string;
}

export interface PulseArticle {
  pulseSlug: PulseSlug;
  articleSlug: string;
  title: string;
  summary?: string | null;
  body?: string | null;
  sourceUrl?: string | null;
  category: string;
  observedStart?: string | null;
  observedEnd?: string | null;
  publishedAt?: string | null;
  raw?: unknown;
}

export interface PulseSchemaMarkup {
  '@context': 'https://schema.org';
  '@type': 'AnalysisNewsArticle';
  [key: string]: unknown;
}

export interface PulseArticleRaw {
  sourceId?: string;
  row?: unknown;
  schemaMarkup?: PulseSchemaMarkup | null;
  [key: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function getPulseRaw(article: PulseArticle): PulseArticleRaw | null {
  if (!isRecord(article.raw)) return null;
  return article.raw as PulseArticleRaw;
}

export function getPulseSchemaMarkup(article: PulseArticle): PulseSchemaMarkup | null {
  const raw = getPulseRaw(article);
  if (!raw || !isRecord(raw.schemaMarkup)) return null;

  const context = raw.schemaMarkup['@context'];
  const type = raw.schemaMarkup['@type'];
  if (context !== 'https://schema.org' || type !== 'AnalysisNewsArticle') return null;

  return raw.schemaMarkup as PulseSchemaMarkup;
}

export function getPulseSourceId(article: PulseArticle): string | null {
  const raw = getPulseRaw(article);
  return typeof raw?.sourceId === 'string' && raw.sourceId.trim() ? raw.sourceId : null;
}

export interface GdeltSummaryRow {
  [key: string]: unknown;
}

export interface GdeltSummaryResponse {
  data?: GdeltSummaryRow[];
  meta?: Record<string, unknown>;
}

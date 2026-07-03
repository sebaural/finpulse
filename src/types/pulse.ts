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

export interface GdeltSummaryRow {
  [key: string]: unknown;
}

export interface GdeltSummaryResponse {
  data?: GdeltSummaryRow[];
  meta?: Record<string, unknown>;
}

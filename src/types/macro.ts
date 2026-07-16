// src/types/macro.ts

/** A single persisted "Macro Landscape" entry. */
export interface MacroArticle {
  id: string;
  slug: string;
  title: string;
  /** ISO date (YYYY-MM-DD), America/New_York — the pagination key. */
  publishedDate: string;
  /** Sanitized HTML fragment. */
  body: string;
  createdAt: Date;
}

/**
 * Lightweight pointer to the entry immediately before/after the current one,
 * so the client can render enabled/disabled Prev/Next controls without a
 * second round trip.
 */
export interface AdjacentMacroArticleInfo {
  slug: string;
  /** ISO date (YYYY-MM-DD). */
  publishedDate: string;
}

/** Response shape for GET /api/macro/articles (single-item + adjacency). */
export interface MacroArticleResponse {
  article: {
    title: string;
    slug: string;
    publishedDate: string;
    body: string;
  } | null;
  previous: AdjacentMacroArticleInfo | null;
  next: AdjacentMacroArticleInfo | null;
}

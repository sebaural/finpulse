// src/types/tech.ts

export interface SourceArticle {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  description?: string;
}

export interface SummaryArticle {
  id: string;
  title: string;
  slug: string;
  summary: string;
  keyPoints: string[];
  sourceArticles: SourceArticle[];
  region: string;
  tags: string[];
  createdAt: Date;
  /** YYYY-MM-DD */
  date: string;
}

export interface DailyTechPage {
  date: string;
  articles: SummaryArticle[];
}

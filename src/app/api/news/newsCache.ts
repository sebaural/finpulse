import type { NewsArticle } from '../../../types';

export interface NewsCacheEntry {
  articles: NewsArticle[];
  usingFallback: boolean;
  timestamp: number;
  provider: string;
  sourcesSignature: string;
}

let newsCache: NewsCacheEntry | null = null;

export function getNewsCache(): NewsCacheEntry | null {
  return newsCache;
}

export function setNewsCache(entry: NewsCacheEntry | null): void {
  newsCache = entry;
}

export function clearNewsCache(): void {
  newsCache = null;
}
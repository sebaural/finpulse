export type { ImpactLabel, NewsArticle, NewsCategory, SourceClass } from './news';
export type { MarketRow, TickerItem } from './market';

export type FeedParser = 'rss2json' | 'json' | 'custom';

export interface FeedSource {
  id: string;
  name: string;
  type: 'rss' | 'api';
  url: string;
  enabled: boolean;
  category: string;
  parser: FeedParser;
  apiKeyEnv?: string;
  refreshIntervalSec: number;
  priority: 1 | 2 | 3;
}

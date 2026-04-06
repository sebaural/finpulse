export type SourceClass = 'reuters' | 'bloomberg';

export type ImpactLabel = 'Bullish' | 'Bearish' | 'Macro' | 'Fed' | 'Oil' | 'Earnings';

export type NewsCategory =
  | 'Markets'
  | 'Economy'
  | 'Equities'
  | 'Forex'
  | 'Commodities'
  | 'Crypto'
  | 'Geopolitics'
  | 'Tech'
  | 'Energy';

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

export interface NewsArticle {
  id: string;
  source: string;
  cls: SourceClass;
  category: NewsCategory;
  importance: 1 | 2 | 3;
  impact: ImpactLabel | null;
  publishedAt?: string;
  title: string;
  summary: string;
  link: string;
  time: string;
}

export interface MarketRow {
  name: string;
  value: string;
  change: string;
  direction: 'pos' | 'neg';
}

export interface TickerItem {
  symbol: string;
  value: string;
  change: string;
  direction: 'pos' | 'neg';
}

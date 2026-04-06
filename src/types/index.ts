export type SourceClass = 'reuters' | 'bloomberg';

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

export interface NewsArticle {
  id: string;
  source: string;
  cls: SourceClass;
  category: NewsCategory;
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

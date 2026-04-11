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

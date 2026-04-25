export type { ImpactLabel, NewsArticle, NewsCategory, SourceClass } from './news';
export type { MarketRow, TickerItem } from './market';
export type { InterruptPolicy, SpeechRules, TraderProfile, VoiceSettings } from './speech';

export interface FeedSource {
  id: string;
  name: string;
  type: 'rss' | 'api';
  url: string;
  enabled: boolean;
  category: string;
  apiKeyEnv?: string;
  priority: 1 | 2 | 3;
}

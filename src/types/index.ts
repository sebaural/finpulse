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

// ── X Auto-Poster types ──────────────────────────────────────────

export type XPosterSection = 'markets' | 'geopolitics' | 'tech';

export interface XSectionConfig {
  section:          XPosterSection;
  label:            string;
  articlesEndpoint: string;
}

export const X_SECTIONS: XSectionConfig[] = [
  { section: 'markets',     label: 'Markets',     articlesEndpoint: '/api/markets/articles'     },
  { section: 'geopolitics', label: 'Geopolitics', articlesEndpoint: '/api/geopolitics/articles' },
  { section: 'tech',        label: 'Tech',        articlesEndpoint: '/api/tech/articles'        },
];

export interface XBriefing {
  section:  XPosterSection;
  title:    string;
  url:      string;
  date:     string;
  bodyText: string;
}

export interface XTweetDraft {
  text:        string;
  briefingUrl: string;
  section:     XPosterSection;
}

export interface XPostResult {
  success:  boolean;
  tweetId?: string;
  error?:   string;
}

export interface XStoredTokens {
  accessToken:  string;
  refreshToken: string;
  expiresAt:    number; // Unix timestamp in seconds
}

export interface XCronResult {
  section:   XPosterSection;
  success:   boolean;
  tweetId?:  string;
  skipped?:  boolean;
  error?:    string;
}

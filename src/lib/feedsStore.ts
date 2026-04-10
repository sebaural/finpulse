import { createClient } from '@vercel/kv';
import type { FeedSource } from '../types';

const kv = createClient({
  url: process.env.FINPULSE_KV_REST_API_URL ?? process.env.KV_REST_API_URL ?? '',
  token: process.env.FINPULSE_KV_REST_API_TOKEN ?? process.env.KV_REST_API_TOKEN ?? '',
});

const KV_KEY = 'feeds:config';

const defaultSources: FeedSource[] = [
  {
    id: 'marketaux-api',
    name: 'MARKETAUX',
    type: 'api',
    url: 'https://api.marketaux.com/v1/news/all?filter_entities=true&language=en&limit=20',
    enabled: false,
    category: 'Markets',
    parser: 'json',
    apiKeyEnv: 'MARKETAUX_KEY',
    refreshIntervalSec: 60,
    priority: 2,
  },
  {
    id: 'finnhub-api',
    name: 'FINNHUB',
    type: 'api',
    url: 'https://finnhub.io/api/v1/news?category=general',
    enabled: false,
    category: 'Markets',
    parser: 'json',
    apiKeyEnv: 'FINNHUB_KEY',
    refreshIntervalSec: 60,
    priority: 2,
  },
  {
    id: 'newsapi-business',
    name: 'NEWSAPI',
    type: 'api',
    url: 'https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=20',
    enabled: false,
    category: 'Markets',
    parser: 'json',
    apiKeyEnv: 'NEWSAPI_KEY',
    refreshIntervalSec: 60,
    priority: 2,
  },
  {
    id: 'gnews-business',
    name: 'GNEWS',
    type: 'api',
    url: 'https://gnews.io/api/v4/top-headlines?topic=business&lang=en&max=20',
    enabled: false,
    category: 'Markets',
    parser: 'json',
    apiKeyEnv: 'GNEWS_API_KEY',
    refreshIntervalSec: 60,
    priority: 2,
  },
  {
    id: 'alphavantage-news',
    name: 'ALPHAVANTAGE',
    type: 'api',
    url: 'https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=financial_markets&sort=LATEST&limit=20',
    enabled: false,
    category: 'Markets',
    parser: 'json',
    apiKeyEnv: 'ALPHAVANTAGE_API_KEY',
    refreshIntervalSec: 60,
    priority: 2,
  },
  {
    id: 'fmp-news',
    name: 'FMP',
    type: 'api',
    url: 'https://financialmodelingprep.com/stable/news/latest?limit=20',
    enabled: false,
    category: 'Markets',
    parser: 'json',
    apiKeyEnv: 'FMP_API_KEY',
    refreshIntervalSec: 60,
    priority: 2,
  },
];

function normalizeSources(sources: FeedSource[]): FeedSource[] {
  const byId = new Map(sources.map((source) => [source.id, source]));
  return defaultSources.map((source) => {
    const existing = byId.get(source.id);
    if (!existing) {
      return source;
    }

    return {
      ...existing,
      id: source.id,
      name: source.name,
      type: source.type,
      url: source.url,
      apiKeyEnv: source.apiKeyEnv,
      parser: source.parser,
    };
  });
}

export async function listFeedSources(): Promise<FeedSource[]> {
  const stored = await kv.get<FeedSource[]>(KV_KEY);
  if (!stored) {
    await kv.set(KV_KEY, defaultSources);
    return defaultSources;
  }

  const normalized = Array.isArray(stored) ? normalizeSources(stored) : defaultSources;
  if (JSON.stringify(normalized) !== JSON.stringify(stored)) {
    await kv.set(KV_KEY, normalized);
  }

  return normalized;
}

export async function saveFeedSources(sources: FeedSource[]): Promise<void> {
  await kv.set(KV_KEY, sources);
}

export { defaultSources };

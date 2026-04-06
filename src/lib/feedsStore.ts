import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FeedSource } from '../types';

const DATA_DIR = path.join(process.cwd(), 'data');
const FEEDS_FILE = path.join(DATA_DIR, 'feeds.json');

const defaultSources: FeedSource[] = [
  {
    id: 'newsapi-business',
    name: 'NewsAPI Business',
    type: 'api',
    url: 'https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=20',
    enabled: true,
    category: 'Markets',
    parser: 'json',
    apiKeyEnv: 'NEWSAPI_KEY',
    refreshIntervalSec: 60,
    priority: 2,
  },
  {
    id: 'gnews-business',
    name: 'GNews Business',
    type: 'api',
    url: 'https://gnews.io/api/v4/top-headlines?topic=business&lang=en&max=20',
    enabled: true,
    category: 'Markets',
    parser: 'json',
    apiKeyEnv: 'GNEWS_API_KEY',
    refreshIntervalSec: 60,
    priority: 2,
  },
  {
    id: 'marketwatch-rss',
    name: 'MarketWatch Top Stories',
    type: 'rss',
    url: 'https://feeds.content.dowjones.io/public/rss/mw_topstories',
    enabled: true,
    category: 'Markets',
    parser: 'custom',
    refreshIntervalSec: 60,
    priority: 2,
  },
  {
    id: 'ap-business-rss',
    name: 'AP Business',
    type: 'rss',
    url: 'https://feeds.apnews.com/rss/APf-Business',
    enabled: true,
    category: 'Economy',
    parser: 'custom',
    refreshIntervalSec: 60,
    priority: 2,
  },
  {
    id: 'cnbc-rss',
    name: 'CNBC Finance',
    type: 'rss',
    url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664',
    enabled: true,
    category: 'Markets',
    parser: 'custom',
    refreshIntervalSec: 60,
    priority: 2,
  },
];

async function ensureFile(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(FEEDS_FILE, 'utf-8');
  } catch {
    await writeFile(FEEDS_FILE, JSON.stringify(defaultSources, null, 2), 'utf-8');
  }
}

export async function listFeedSources(): Promise<FeedSource[]> {
  await ensureFile();
  const raw = await readFile(FEEDS_FILE, 'utf-8');
  const parsed = JSON.parse(raw) as FeedSource[];
  return Array.isArray(parsed) ? parsed : [];
}

export async function saveFeedSources(sources: FeedSource[]): Promise<void> {
  await ensureFile();
  await writeFile(FEEDS_FILE, JSON.stringify(sources, null, 2), 'utf-8');
}

export { defaultSources };

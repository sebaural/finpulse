import type { MarketRow, NewsArticle, NewsCategory, SourceClass, TickerItem } from '../types';

export interface NewsResponse {
  articles: NewsArticle[];
  usingFallback: boolean;
}

export const tickerItems: TickerItem[] = [
  { symbol: 'S&P 500', value: '5,234.18', change: '+0.82%', direction: 'pos' },
  { symbol: 'NASDAQ', value: '16,428.90', change: '+1.14%', direction: 'pos' },
  { symbol: 'DOW', value: '39,114.86', change: '-0.31%', direction: 'neg' },
  { symbol: 'FTSE 100', value: '7,932.60', change: '+0.55%', direction: 'pos' },
  { symbol: 'EUR/USD', value: '1.0842', change: '-0.12%', direction: 'neg' },
  { symbol: 'GBP/USD', value: '1.2714', change: '+0.08%', direction: 'pos' },
  { symbol: 'USD/JPY', value: '151.32', change: '+0.44%', direction: 'pos' },
  { symbol: 'BTC/USD', value: '67,440', change: '+2.31%', direction: 'pos' },
  { symbol: 'GOLD', value: '$2,183', change: '+0.19%', direction: 'pos' },
  { symbol: 'CRUDE OIL', value: '$81.42', change: '-0.67%', direction: 'neg' },
];

export const marketRows: MarketRow[] = [
  { name: 'S&P 500', value: '5,234.18', change: '+0.82%', direction: 'pos' },
  { name: 'NASDAQ', value: '16,428.90', change: '+1.14%', direction: 'pos' },
  { name: 'DOW JONES', value: '39,114.86', change: '-0.31%', direction: 'neg' },
  { name: 'GOLD', value: '$2,183', change: '+0.19%', direction: 'pos' },
  { name: 'CRUDE OIL', value: '$81.42', change: '-0.67%', direction: 'neg' },
  { name: 'EUR/USD', value: '1.0842', change: '-0.12%', direction: 'neg' },
  { name: 'BTC/USD', value: '$67,440', change: '+2.31%', direction: 'pos' },
  { name: '10Y Treasury', value: '4.312%', change: '+3bps', direction: 'pos' },
];

export const demoSeed: Omit<NewsArticle, 'id'>[] = [
  {
    source: 'Reuters',
    cls: 'reuters',
    category: 'Markets',
    title: 'FED signals slower pace of rate cuts as inflation proves sticky',
    summary: 'Federal Reserve officials signaled they are in no rush to reduce interest rates further, citing persistent inflation pressures and a resilient labor market.',
    link: 'https://reuters.com',
    time: '2 min ago',
  },
  {
    source: 'Bloomberg',
    cls: 'bloomberg',
    category: 'Economy',
    title: 'US CONSUMER SPENDING RISES FOR SECOND CONSECUTIVE MONTH',
    summary: 'Consumer spending increased for the second month in a row, suggesting resilient demand despite elevated borrowing costs.',
    link: 'https://bloomberg.com',
    time: '18 min ago',
  },
  {
    source: 'Reuters',
    cls: 'reuters',
    category: 'Energy',
    title: 'OPEC+ agrees to extend output cuts through mid-year',
    summary: 'The alliance reached consensus to maintain current production restrictions through June to stabilize prices.',
    link: 'https://reuters.com',
    time: '34 min ago',
  },
  {
    source: 'Bloomberg',
    cls: 'bloomberg',
    category: 'Tech',
    title: 'AI chipmaker surge pushes tech stocks to record highs',
    summary: 'Semiconductor stocks climbed as investors doubled down on AI infrastructure demand.',
    link: 'https://bloomberg.com',
    time: '51 min ago',
  },
  {
    source: 'Reuters',
    cls: 'reuters',
    category: 'Markets',
    title: 'Dollar strengthens as Treasury yields climb on jobs data',
    summary: 'The dollar extended gains after payroll figures beat expectations, reinforcing higher-for-longer rate bets.',
    link: 'https://reuters.com',
    time: '1 hr ago',
  },
  {
    source: 'Bloomberg',
    cls: 'bloomberg',
    category: 'Markets',
    title: 'Japanese yen hits multi-decade low versus dollar',
    summary: 'Authorities issued verbal warnings about intervention as currency weakness deepened.',
    link: 'https://bloomberg.com',
    time: '1.5 hr ago',
  },
];

export function toId(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

export function detectCategory(text: string): NewsCategory {
  const t = text.toLowerCase();
  if (/bitcoin|btc|ethereum|eth|crypto|defi|nft|blockchain|altcoin/.test(t)) return 'Crypto';
  if (/oil|gas|energy|opec|crude|refin|lithium|lng|pipeline/.test(t)) return 'Energy';
  if (/tech|ai|chip|software|amazon|google|apple|microsoft|meta|nvidia|semiconductor/.test(t)) return 'Tech';
  if (/forex|fx|currency|dollar|euro|yen|pound|yuan|sterling|exchange rate|dxy/.test(t)) return 'Forex';
  if (/commodity|commodities|wheat|corn|soybean|cotton|copper|gold|silver|metals/.test(t)) return 'Commodities';
  if (/geopolit|war|conflict|sanction|nato|ukraine|russia|taiwan|iran|middle east|israel/.test(t)) return 'Geopolitics';
  if (/stock|equit|share|ipo|dividend|earnings|s&p|nasdaq|dow|nyse|listed|equity/.test(t)) return 'Equities';
  if (/gdp|inflation|jobs|employment|cpi|recession|growth|consumer|fed|central bank|interest rate/.test(t)) return 'Economy';
  return 'Markets';
}

export function inferSourceClass(source: string): SourceClass {
  const normalized = source.toLowerCase();
  if (normalized.includes('reuters')) return 'reuters';
  return 'bloomberg';
}

export function timeAgo(date: Date): string {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function normalizeArticle(article: Omit<NewsArticle, 'id'>): NewsArticle {
  const base = `${article.source}-${article.title}-${article.time}`;
  return {
    ...article,
    id: toId(base),
  };
}

export function fallbackNewsResponse(): NewsResponse {
  return {
    articles: demoSeed.map(normalizeArticle),
    usingFallback: true,
  };
}

export async function loadNewsArticles(): Promise<NewsResponse> {
  try {
    const res = await fetch('/api/news', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return fallbackNewsResponse();
    }

    const data = (await res.json()) as NewsResponse;
    if (!Array.isArray(data.articles) || typeof data.usingFallback !== 'boolean') {
      return fallbackNewsResponse();
    }

    return data;
  } catch {
    return fallbackNewsResponse();
  }
}

import { NextResponse } from 'next/server';
import {
  detectCategory,
  detectImpact,
  detectImportance,
  fallbackNewsResponse,
  inferSourceClass,
  normalizeArticle,
  toId,
  timeAgo,
} from '../../../services/news';
import { listFeedSources } from '../feeds/feedsStore';
import { newsProviderEnv } from '../../../lib/env';
import type { FeedSource, NewsArticle } from '../../../types';

const PROVIDER_TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 30_000; // 30 seconds

interface CacheEntry {
  articles: NewsArticle[];
  usingFallback: boolean;
  timestamp: number;
  provider: string;
  sourcesSignature: string;
}

let newsCache: CacheEntry | null = null;

interface ProviderResult {
  provider: string;
  articles: NewsArticle[];
  ok: boolean;
  error?: string;
}

function parseApiDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  // AlphaVantage compact format: "20240410T120000"
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?/);
  if (compact) {
    const [, yr, mo, dy, hr, min, sec = '00'] = compact;
    const d = new Date(`${yr}-${mo}-${dy}T${hr}:${min}:${sec}Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  // Space-separator format: "2024-04-10 12:00:00" (FMP and others)
  const spaceSep = raw.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})/);
  if (spaceSep) {
    const d = new Date(`${spaceSep[1]}T${spaceSep[2]}Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function publishedAtMs(article: NewsArticle): number {
  const d = parseApiDate(article.publishedAt);
  return d ? d.getTime() : 0;
}

function sortNewestFirst(articles: NewsArticle[]): NewsArticle[] {
  return [...articles].sort((a, b) => publishedAtMs(b) - publishedAtMs(a));
}

function sanitizeArticles(articles: NewsArticle[]): NewsArticle[] {
  const sorted = sortNewestFirst(articles);

  // Remove obvious duplicates first so the feed does not show repeated stories.
  const seenFingerprints = new Set<string>();
  const deduped: NewsArticle[] = [];

  for (const article of sorted) {
    const linkFingerprint = article.link.trim().toLowerCase();
    const titleFingerprint = `${article.source.trim().toLowerCase()}|${article.title.trim().toLowerCase()}`;
    const fingerprint = linkFingerprint || titleFingerprint;

    if (seenFingerprints.has(fingerprint)) {
      continue;
    }

    seenFingerprints.add(fingerprint);
    deduped.push(article);
  }

  // Ensure IDs are unique for stable React keys, even when upstream stories collide.
  const idCounts = new Map<string, number>();
  return deduped.map((article) => {
    const count = idCounts.get(article.id) ?? 0;
    idCounts.set(article.id, count + 1);

    if (count === 0) {
      return article;
    }

    const stableSuffix = toId(article.link).slice(0, 24) || `dup-${count}`;
    return {
      ...article,
      id: `${article.id}-${stableSuffix}-${count}`,
    };
  });
}

function decodeHtmlEntities(input: string): string {
  // Unescape &amp; first so double-encoded entities (&amp;#x2019;) become &#x2019;
  let s = input.replace(/&amp;/g, '&');
  s = s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
  return s;
}

function cleanSummary(input: string | null | undefined): string {
  return decodeHtmlEntities((input ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()).slice(0, 220);
}

function parseDateToAgo(raw: string | null | undefined): string {
  const d = parseApiDate(raw);
  return d ? timeAgo(d) : 'Just now';
}

interface RssItem {
  title: string;
  summary: string;
  link: string;
  pubDate: string;
}

function extractCdata(raw: string): string {
  const cdata = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return cdata ? cdata[1] : raw;
}

function extractTag(xml: string, tag: string): string {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\/${tag}>`, 'i');
  const match = xml.match(pattern);
  if (!match) return '';
  return extractCdata(match[1]).trim();
}

function parseRssXml(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];

  for (const block of itemBlocks) {
    const title = extractTag(block, 'title');
    const description = extractTag(block, 'description');

    // <link> in RSS is a plain text node between tags
    const linkMatch =
      block.match(/<link>([^<]+)<\/link>/i) ??
      block.match(/<link\s+href=["']([^"']+)["']/i) ??
      block.match(/<guid[^>]*isPermaLink=["']true["'][^>]*>([^<]+)<\/guid>/i) ??
      block.match(/<guid[^>]*>(https?:\/\/[^<]+)<\/guid>/i);
    const link = (linkMatch?.[1] ?? '').trim();

    const pubDateMatch = block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
    const pubDate = (pubDateMatch?.[1] ?? '').trim();

    if (title.length > 10 && link) {
      items.push({ title, summary: description, link, pubDate });
    }
  }

  return items;
}

async function fetchRssSource(url: string, sourceName: string): Promise<ProviderResult> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FinPulse/1.0)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} from ${url}`);
    }

    const xml = await res.text();
    const rssItems = parseRssXml(xml);

    const articles = rssItems
      .map((item) =>
        normalizeExternalArticle({
          source: sourceName,
          title: item.title,
          summary: item.summary,
          link: item.link,
          publishedAt: item.pubDate || null,
        }),
      )
      .filter((a): a is NewsArticle => a !== null);

    const providerId = sourceName.toLowerCase().replace(/\s+/g, '_');
    return { provider: providerId, articles, ok: true };
  } catch (error) {
    const providerId = sourceName.toLowerCase().replace(/\s+/g, '_');
    return {
      provider: providerId,
      articles: [],
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown RSS error',
    };
  }
}

function normalizeExternalArticle(input: {
  source: string;
  title: string;
  summary: string;
  link: string;
  publishedAt?: string | null;
}): NewsArticle | null {
  const title = decodeHtmlEntities(input.title.trim());
  const summary = cleanSummary(input.summary);
  const link = input.link.trim();
  const source = input.source.trim() || 'Market Wire';

  if (title.length <= 10 || !link) {
    return null;
  }

  const textForDetection = `${title} ${summary}`;
  return normalizeArticle({
    source,
    cls: inferSourceClass(source),
    category: detectCategory(textForDetection),
    importance: detectImportance(textForDetection),
    impact: detectImpact(textForDetection),
    publishedAt: parseApiDate(input.publishedAt)?.toISOString(),
    title,
    summary,
    link,
    time: parseDateToAgo(input.publishedAt),
  });
}

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
    cache: 'no-store',
    headers,
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from ${url}`);
  }

  return (await res.json()) as T;
}

async function fetchFromNewsApi(apiKey: string): Promise<ProviderResult> {
  interface NewsApiArticle {
    source?: { name?: string };
    title?: string;
    description?: string;
    content?: string;
    url?: string;
    publishedAt?: string;
  }

  interface NewsApiResponse {
    status: string;
    articles?: NewsApiArticle[];
    message?: string;
  }

  try {
    const data = await fetchJson<NewsApiResponse>(
      'https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=20',
      { 'X-Api-Key': apiKey },
    );

    if (data.status !== 'ok') {
      return {
        provider: 'newsapi',
        articles: [],
        ok: false,
        error: data.message ?? 'NewsAPI returned non-ok status',
      };
    }

    const articles = (data.articles ?? [])
      .map((item) =>
        normalizeExternalArticle({
          source: item.source?.name ?? 'NewsAPI',
          title: item.title ?? '',
          summary: item.description ?? item.content ?? '',
          link: item.url ?? '',
          publishedAt: item.publishedAt,
        }),
      )
      .filter((item): item is NewsArticle => Boolean(item));

    return { provider: 'newsapi', articles, ok: true };
  } catch (error) {
    return {
      provider: 'newsapi',
      articles: [],
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown NewsAPI error',
    };
  }
}

async function fetchFromGNews(apiKey: string): Promise<ProviderResult> {
  interface GNewsArticle {
    source?: { name?: string };
    title?: string;
    description?: string;
    content?: string;
    url?: string;
    publishedAt?: string;
  }

  interface GNewsResponse {
    totalArticles?: number;
    articles?: GNewsArticle[];
  }

  try {
    const url = `https://gnews.io/api/v4/top-headlines?topic=business&lang=en&max=20&token=${encodeURIComponent(apiKey)}`;
    const data = await fetchJson<GNewsResponse>(url);

    const articles = (data.articles ?? [])
      .map((item) =>
        normalizeExternalArticle({
          source: item.source?.name ?? 'GNews',
          title: item.title ?? '',
          summary: item.description ?? item.content ?? '',
          link: item.url ?? '',
          publishedAt: item.publishedAt,
        }),
      )
      .filter((item): item is NewsArticle => Boolean(item));

    return { provider: 'gnews', articles, ok: true };
  } catch (error) {
    return {
      provider: 'gnews',
      articles: [],
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown GNews error',
    };
  }
}

async function fetchFromAlphaVantage(apiKey: string): Promise<ProviderResult> {
  interface AlphaFeedItem {
    title?: string;
    summary?: string;
    url?: string;
    time_published?: string;
    source?: string;
  }

  interface AlphaResponse {
    feed?: AlphaFeedItem[];
    Note?: string;
    Information?: string;
  }

  try {
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&topics=financial_markets&sort=LATEST&limit=20&apikey=${encodeURIComponent(apiKey)}`;
    const data = await fetchJson<AlphaResponse>(url);

    if (data.Note || data.Information) {
      return {
        provider: 'alphavantage',
        articles: [],
        ok: false,
        error: data.Note ?? data.Information,
      };
    }

    const articles = (data.feed ?? [])
      .map((item) =>
        normalizeExternalArticle({
          source: item.source ?? 'Alpha Vantage',
          title: item.title ?? '',
          summary: item.summary ?? '',
          link: item.url ?? '',
          publishedAt: item.time_published ?? null,
        }),
      )
      .filter((item): item is NewsArticle => Boolean(item));

    return { provider: 'alphavantage', articles, ok: true };
  } catch (error) {
    return {
      provider: 'alphavantage',
      articles: [],
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown Alpha Vantage error',
    };
  }
}

async function fetchFromFmp(apiKey: string): Promise<ProviderResult> {
  interface FmpArticle {
    title?: string;
    text?: string;
    url?: string;
    publishedDate?: string;
    site?: string;
  }

  try {
    const url = `https://financialmodelingprep.com/stable/news/latest?limit=20&apikey=${encodeURIComponent(apiKey)}`;
    const data = await fetchJson<FmpArticle[]>(url);

    const articles = (data ?? [])
      .map((item) =>
        normalizeExternalArticle({
          source: item.site ?? 'Financial Modeling Prep',
          title: item.title ?? '',
          summary: item.text ?? '',
          link: item.url ?? '',
          publishedAt: item.publishedDate ?? null,
        }),
      )
      .filter((item): item is NewsArticle => Boolean(item));

    return { provider: 'fmp', articles, ok: true };
  } catch (error) {
    return {
      provider: 'fmp',
      articles: [],
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown FMP error',
    };
  }
}

async function fetchFromMarketaux(apiKey: string): Promise<ProviderResult> {
  interface MarketauxArticle {
    title?: string;
    description?: string;
    url?: string;
    published_at?: string;
    source?: string;
  }

  interface MarketauxResponse {
    data?: MarketauxArticle[];
    error?: { message?: string };
  }

  try {
    const url = `https://api.marketaux.com/v1/news/all?filter_entities=true&language=en&limit=20&api_token=${encodeURIComponent(apiKey)}`;
    const data = await fetchJson<MarketauxResponse>(url);

    if (data.error) {
      return { provider: 'marketaux', articles: [], ok: false, error: data.error.message };
    }

    const articles = (data.data ?? [])
      .map((item) =>
        normalizeExternalArticle({
          source: item.source ?? 'Marketaux',
          title: item.title ?? '',
          summary: item.description ?? '',
          link: item.url ?? '',
          publishedAt: item.published_at ?? null,
        }),
      )
      .filter((item): item is NewsArticle => Boolean(item));

    return { provider: 'marketaux', articles, ok: true };
  } catch (error) {
    return {
      provider: 'marketaux',
      articles: [],
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown Marketaux error',
    };
  }
}

async function fetchFromFinnhub(apiKey: string): Promise<ProviderResult> {
  interface FinnhubArticle {
    headline?: string;
    summary?: string;
    url?: string;
    datetime?: number;
    source?: string;
  }

  try {
    const url = `https://finnhub.io/api/v1/news?category=general&token=${encodeURIComponent(apiKey)}`;
    const data = await fetchJson<FinnhubArticle[]>(url);

    const articles = (data ?? [])
      .map((item) =>
        normalizeExternalArticle({
          source: item.source ?? 'Finnhub',
          title: item.headline ?? '',
          summary: item.summary ?? '',
          link: item.url ?? '',
          publishedAt: item.datetime ? new Date(item.datetime * 1000).toISOString() : null,
        }),
      )
      .filter((item): item is NewsArticle => Boolean(item));

    return { provider: 'finnhub', articles, ok: true };
  } catch (error) {
    return {
      provider: 'finnhub',
      articles: [],
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown Finnhub error',
    };
  }
}

function providerForSource(source: FeedSource):
  | 'newsapi'
  | 'gnews'
  | 'alphavantage'
  | 'fmp'
  | 'marketaux'
  | 'finnhub'
  | 'rss'
  | 'unsupported' {
  if (source.type === 'rss') return 'rss';

  const id = source.id.toLowerCase();
  const url = source.url.toLowerCase();
  const envKey = (source.apiKeyEnv ?? '').toLowerCase();

  if (id.includes('newsapi') || url.includes('newsapi.org') || envKey === 'newsapi_key') return 'newsapi';
  if (id.includes('gnews') || url.includes('gnews.io') || envKey === 'gnews_api_key') return 'gnews';
  if (id.includes('alphavantage') || url.includes('alphavantage.co') || envKey === 'alphavantage_api_key') return 'alphavantage';
  if (id.includes('fmp') || url.includes('financialmodelingprep.com') || envKey === 'fmp_api_key') return 'fmp';
  if (id.includes('marketaux') || url.includes('marketaux.com') || envKey === 'marketaux_key') return 'marketaux';
  if (id.includes('finnhub') || url.includes('finnhub.io') || envKey === 'finnhub_key') return 'finnhub';

  return 'unsupported';
}

function resolveApiKey(source: FeedSource): string {
  const keyFromEnvName = source.apiKeyEnv ? (process.env[source.apiKeyEnv] ?? '').trim() : '';
  if (keyFromEnvName) return keyFromEnvName;

  const provider = providerForSource(source);
  if (provider === 'newsapi') return newsProviderEnv.newsApiKey;
  if (provider === 'gnews') return newsProviderEnv.gnewsApiKey;
  if (provider === 'alphavantage') return newsProviderEnv.alphaVantageApiKey;
  if (provider === 'fmp') return newsProviderEnv.fmpApiKey;
  if (provider === 'marketaux') return newsProviderEnv.marketauxKey;
  if (provider === 'finnhub') return newsProviderEnv.finnhubKey;

  return '';
}

async function fetchFromConfiguredSource(source: FeedSource): Promise<ProviderResult> {
  const provider = providerForSource(source);

  if (provider === 'rss') {
    return fetchRssSource(source.url, source.name);
  }

  const apiKey = resolveApiKey(source);
  if (!apiKey) {
    return {
      provider: source.id,
      articles: [],
      ok: false,
      error: source.apiKeyEnv
        ? `Missing API key in ${source.apiKeyEnv}`
        : `Missing API key for provider ${provider}`,
    };
  }

  if (provider === 'newsapi') return fetchFromNewsApi(apiKey);
  if (provider === 'gnews') return fetchFromGNews(apiKey);
  if (provider === 'alphavantage') return fetchFromAlphaVantage(apiKey);
  if (provider === 'fmp') return fetchFromFmp(apiKey);
  if (provider === 'marketaux') return fetchFromMarketaux(apiKey);
  if (provider === 'finnhub') return fetchFromFinnhub(apiKey);

  return {
    provider: source.id,
    articles: [],
    ok: false,
    error: 'Unsupported source provider mapping',
  };
}

function sourcesSignature(sources: FeedSource[]): string {
  return sources
    .map((s) => `${s.id}:${s.enabled}:${s.priority}:${s.url}`)
    .sort()
    .join('|');
}

async function getEnabledSources(): Promise<FeedSource[]> {
  const sources = await listFeedSources();
  return sources
    .filter((s) => s.enabled)
    .sort((a, b) => a.priority - b.priority);
}

async function fetchAllEnabledSources(enabledSources: FeedSource[]): Promise<ProviderResult[]> {
  return Promise.all(enabledSources.map((source) => fetchFromConfiguredSource(source)));
}

export async function GET() {
  const now = Date.now();
  const enabledSources = await getEnabledSources();
  const currentSignature = sourcesSignature(enabledSources);

  // Serve from cache if still fresh
  if (
    newsCache
    && now - newsCache.timestamp < CACHE_TTL_MS
    && newsCache.sourcesSignature === currentSignature
  ) {
    return NextResponse.json(
      { articles: newsCache.articles, usingFallback: newsCache.usingFallback },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=30',
          'X-News-Provider': newsCache.provider,
          'X-Cache': 'HIT',
        },
      },
    );
  }

  const providerResults = await fetchAllEnabledSources(enabledSources);
  const liveResults = providerResults.filter((result) => result.articles.length > 0);

  if (liveResults.length > 0) {
    const mergedArticles = liveResults.flatMap((result) => result.articles);
    const sanitizedArticles = sanitizeArticles(mergedArticles);
    const providerName = liveResults.map((result) => result.provider).join(',');

    newsCache = {
      articles: sanitizedArticles,
      usingFallback: false,
      timestamp: now,
      provider: providerName,
      sourcesSignature: currentSignature,
    };

    return NextResponse.json(
      {
        articles: sanitizedArticles,
        usingFallback: false,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=30',
          'X-News-Provider': providerName,
          'X-Provider-Status': 'live',
          'X-Cache': 'MISS',
        },
      },
    );
  }

  const fallback = fallbackNewsResponse();
  const fallbackArticles = sanitizeArticles(fallback.articles);
  const attemptedProviders = providerResults.map((result) => {
    if (!result.ok && result.error) {
      return `${result.provider}: ${result.error}`;
    }
    return `${result.provider}: insufficient articles`;
  });

  const message = attemptedProviders.length
    ? `Using fallback data. Provider failures: ${attemptedProviders.join(' | ')}`
    : 'Using fallback data. No structured news API keys configured.';

  console.warn(message);

  return NextResponse.json({ articles: fallbackArticles, usingFallback: fallback.usingFallback }, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
      'X-News-Provider': 'fallback-demo',
      'X-Provider-Status': 'fallback',
    },
  });
}
import { NextResponse } from 'next/server';
import type { MarketRow, TickerItem } from '../../../types';

const FINNHUB_KEY = (process.env.FINNHUB_KEY ?? '').trim();
const CACHE_TTL_MS = 60_000; // 60 seconds

export interface MarketResponse {
  tickerItems: TickerItem[];
  marketRows: MarketRow[];
  cachedAt: string;
  live: boolean;
}

interface CacheEntry {
  data: MarketResponse;
  timestamp: number;
}

let marketCache: CacheEntry | null = null;

// Finnhub symbol → display label
const TICKER_SYMBOLS: Array<{ symbol: string; label: string; prefix?: string }> = [
  { symbol: 'SPY', label: 'S&P 500' },
  { symbol: 'QQQ', label: 'NASDAQ' },
  { symbol: 'DIA', label: 'DOW' },
  { symbol: 'FOREXCOM:EURUSD', label: 'EUR/USD' },
  { symbol: 'FOREXCOM:GBPUSD', label: 'GBP/USD' },
  { symbol: 'FOREXCOM:USDJPY', label: 'USD/JPY' },
  { symbol: 'BINANCE:BTCUSDT', label: 'BTC/USD' },
  { symbol: 'OANDA:XAUUSD', label: 'GOLD', prefix: '$' },
  { symbol: 'NYMEX:CL1!', label: 'CRUDE OIL', prefix: '$' },
];

const SNAPSHOT_SYMBOLS: Array<{ symbol: string; name: string; prefix?: string; suffix?: string }> = [
  { symbol: 'SPY', name: 'S&P 500' },
  { symbol: 'QQQ', name: 'NASDAQ' },
  { symbol: 'DIA', name: 'DOW JONES' },
  { symbol: 'OANDA:XAUUSD', name: 'GOLD', prefix: '$' },
  { symbol: 'NYMEX:CL1!', name: 'CRUDE OIL', prefix: '$' },
  { symbol: 'FOREXCOM:EURUSD', name: 'EUR/USD' },
  { symbol: 'BINANCE:BTCUSDT', name: 'BTC/USD', prefix: '$' },
];

interface FinnhubQuote {
  c: number;  // current price
  d: number;  // change
  dp: number; // change percent
  h: number;  // high
  l: number;  // low
  o: number;  // open
  pc: number; // previous close
  t: number;  // timestamp
}

function formatPrice(value: number, prefix = ''): string {
  if (value >= 10000) return `${prefix}${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (value >= 100) return `${prefix}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${prefix}${value.toFixed(4)}`;
}

function formatChange(dp: number): string {
  const abs = Math.abs(dp);
  return `${dp >= 0 ? '+' : '-'}${abs.toFixed(2)}%`;
}

async function fetchQuote(symbol: string): Promise<FinnhubQuote | null> {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(FINNHUB_KEY)}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as FinnhubQuote;
    // Finnhub returns { c: 0 } when symbol is unknown
    if (!data.c) return null;
    return data;
  } catch {
    return null;
  }
}

// Static fallback values (used when Finnhub is unavailable)
const STATIC_TICKER: TickerItem[] = [
  { symbol: 'S&P 500', value: '5,234.18', change: '+0.82%', direction: 'pos' },
  { symbol: 'NASDAQ', value: '16,428.90', change: '+1.14%', direction: 'pos' },
  { symbol: 'DOW', value: '39,114.86', change: '-0.31%', direction: 'neg' },
  { symbol: 'EUR/USD', value: '1.0842', change: '-0.12%', direction: 'neg' },
  { symbol: 'GBP/USD', value: '1.2714', change: '+0.08%', direction: 'pos' },
  { symbol: 'USD/JPY', value: '151.32', change: '+0.44%', direction: 'pos' },
  { symbol: 'BTC/USD', value: '67,440', change: '+2.31%', direction: 'pos' },
  { symbol: 'GOLD', value: '$2,183', change: '+0.19%', direction: 'pos' },
  { symbol: 'CRUDE OIL', value: '$81.42', change: '-0.67%', direction: 'neg' },
];

const STATIC_ROWS: MarketRow[] = [
  { name: 'S&P 500', value: '5,234.18', change: '+0.82%', direction: 'pos' },
  { name: 'NASDAQ', value: '16,428.90', change: '+1.14%', direction: 'pos' },
  { name: 'DOW JONES', value: '39,114.86', change: '-0.31%', direction: 'neg' },
  { name: 'GOLD', value: '$2,183', change: '+0.19%', direction: 'pos' },
  { name: 'CRUDE OIL', value: '$81.42', change: '-0.67%', direction: 'neg' },
  { name: 'EUR/USD', value: '1.0842', change: '-0.12%', direction: 'neg' },
  { name: 'BTC/USD', value: '$67,440', change: '+2.31%', direction: 'pos' },
];

export async function GET() {
  const now = Date.now();

  if (marketCache && now - marketCache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json(marketCache.data, {
      headers: { 'Cache-Control': 'public, max-age=60', 'X-Cache': 'HIT' },
    });
  }

  if (!FINNHUB_KEY) {
    const fallback: MarketResponse = {
      tickerItems: STATIC_TICKER,
      marketRows: STATIC_ROWS,
      cachedAt: new Date().toISOString(),
      live: false,
    };
    return NextResponse.json(fallback, {
      headers: { 'Cache-Control': 'no-store', 'X-Cache': 'MISS' },
    });
  }

  // Fetch all unique symbols in parallel
  const allSymbols = [
    ...TICKER_SYMBOLS.map((s) => s.symbol),
    ...SNAPSHOT_SYMBOLS.map((s) => s.symbol),
  ];
  const uniqueSymbols = [...new Set(allSymbols)];

  const quoteMap = new Map<string, FinnhubQuote>();
  const results = await Promise.allSettled(
    uniqueSymbols.map(async (sym) => {
      const q = await fetchQuote(sym);
      if (q) quoteMap.set(sym, q);
    }),
  );

  const totalFetched = results.filter((r) => r.status === 'fulfilled').length;
  const anyLive = quoteMap.size >= 3;

  if (!anyLive) {
    const fallback: MarketResponse = {
      tickerItems: STATIC_TICKER,
      marketRows: STATIC_ROWS,
      cachedAt: new Date().toISOString(),
      live: false,
    };
    return NextResponse.json(fallback, {
      headers: { 'Cache-Control': 'no-store', 'X-Cache': 'MISS' },
    });
  }

  const tickerItems: TickerItem[] = TICKER_SYMBOLS.map(({ symbol, label, prefix = '' }) => {
    const q = quoteMap.get(symbol);
    if (!q) {
      const fallback = STATIC_TICKER.find((t) => t.symbol === label);
      return fallback ?? { symbol: label, value: '–', change: '–', direction: 'pos' as const };
    }
    return {
      symbol: label,
      value: formatPrice(q.c, prefix),
      change: formatChange(q.dp),
      direction: q.dp >= 0 ? 'pos' : 'neg',
    };
  });

  const marketRows: MarketRow[] = SNAPSHOT_SYMBOLS.map(({ symbol, name, prefix = '' }) => {
    const q = quoteMap.get(symbol);
    if (!q) {
      const fallback = STATIC_ROWS.find((r) => r.name === name);
      return fallback ?? { name, value: '–', change: '–', direction: 'pos' as const };
    }
    return {
      name,
      value: formatPrice(q.c, prefix),
      change: formatChange(q.dp),
      direction: q.dp >= 0 ? 'pos' : 'neg',
    };
  });

  const data: MarketResponse = {
    tickerItems,
    marketRows,
    cachedAt: new Date().toISOString(),
    live: true,
  };

  marketCache = { data, timestamp: now };

  console.info(`[market] Fetched ${quoteMap.size}/${uniqueSymbols.length} quotes. totalFetched=${totalFetched}`);

  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=60', 'X-Cache': 'MISS' },
  });
}

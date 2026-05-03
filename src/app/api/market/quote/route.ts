import { NextRequest, NextResponse } from 'next/server';
import type { MarketRow, TickerItem } from '../../../../types';

const FINNHUB_KEY = (process.env.FINNHUB_KEY ?? '').trim();

interface FinnhubQuote {
  c: number; d: number; dp: number; h: number; l: number; o: number; pc: number;
}

function formatPrice(value: number): string {
  if (value >= 10000) return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (value >= 100) return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return value.toFixed(4);
}

function formatChange(dp: number): string {
  return `${dp >= 0 ? '+' : '-'}${Math.abs(dp).toFixed(2)}%`;
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.trim();
  const label = request.nextUrl.searchParams.get('label')?.trim() ?? symbol ?? '';

  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 });
  if (!FINNHUB_KEY) return NextResponse.json({ error: 'no api key' }, { status: 503 });

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(FINNHUB_KEY)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: 502 });
    const q = (await res.json()) as FinnhubQuote;
    if (!q.c) return NextResponse.json({ error: 'unknown symbol' }, { status: 404 });

    const direction = q.dp >= 0 ? 'pos' : 'neg';
    const value = formatPrice(q.c);
    const change = formatChange(q.dp);

    const row: MarketRow = { name: label, value, change, direction };
    const ticker: TickerItem = { symbol: label, value, change, direction };

    return NextResponse.json({ row, ticker });
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 502 });
  }
}

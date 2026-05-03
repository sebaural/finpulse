import { NextRequest, NextResponse } from 'next/server';

const FINNHUB_KEY = (process.env.FINNHUB_KEY ?? '').trim();

interface FinnhubSearchResult {
  symbol: string;
  description: string;
  type: string;
}

interface FinnhubSearchResponse {
  count: number;
  result: FinnhubSearchResult[];
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ results: [] });
  if (!FINNHUB_KEY) return NextResponse.json({ results: [] });

  try {
    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(q)}&token=${encodeURIComponent(FINNHUB_KEY)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ results: [] });
    const data = (await res.json()) as FinnhubSearchResponse;
    const results = (data.result ?? [])
      .filter((r) => r.type === 'Common Stock' || r.type === 'ETP')
      .slice(0, 8)
      .map((r) => ({ symbol: r.symbol, description: r.description }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}

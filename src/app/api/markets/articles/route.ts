// src/app/api/markets/articles/route.ts

import { NextResponse } from 'next/server';
import { getMarketsSummaryArticles } from '@/lib/markets-service';

export async function GET() {
  try {
    const articles = await getMarketsSummaryArticles(30);
    return NextResponse.json({ articles });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to fetch articles', details }, { status: 500 });
  }
}

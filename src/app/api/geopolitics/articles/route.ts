// src/app/api/geopolitics/articles/route.ts

import { NextResponse } from 'next/server';
import { getSummaryArticles } from '@/lib/geopolitics-service';

export async function GET() {
  try {
    const articles = await getSummaryArticles(30);
    return NextResponse.json({ articles });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to fetch articles', details }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { isPulseSlug } from '@/lib/pulse-categories';
import { getLatestArticlePerCategory, getPulseArticles } from '@/lib/pulse-service';

export async function GET(req: NextRequest) {
  try {
    const pulseSlug = req.nextUrl.searchParams.get('pulseSlug');

    if (pulseSlug) {
      if (!isPulseSlug(pulseSlug)) {
        return NextResponse.json({ error: 'Invalid pulseSlug' }, { status: 400 });
      }

      return NextResponse.json({ data: await getPulseArticles(pulseSlug) });
    }

    return NextResponse.json({ data: await getLatestArticlePerCategory() });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to fetch pulse articles', details }, { status: 500 });
  }
}

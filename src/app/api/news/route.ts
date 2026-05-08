import { NextResponse } from 'next/server';
import { getAggregatedNews } from '@/server/news';

export async function GET() {
  const result = await getAggregatedNews();

  if (result.status === 'live') {
    return NextResponse.json(
      { articles: result.articles, usingFallback: result.usingFallback },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=30',
          'X-News-Provider': result.provider,
          'X-Provider-Status': 'live',
          'X-Cache': result.fromCache ? 'HIT' : 'MISS',
        },
      },
    );
  }

  if (result.warnings.length > 0) {
    console.warn(`Using fallback data. Provider failures: ${result.warnings.join(' | ')}`);
  } else {
    console.warn('Using fallback data. No structured news API keys configured.');
  }

  return NextResponse.json(
    { articles: result.articles, usingFallback: result.usingFallback },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store',
        'X-News-Provider': result.provider,
        'X-Provider-Status': 'fallback',
      },
    },
  );
}

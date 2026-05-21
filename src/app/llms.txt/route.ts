import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/seo';

export const revalidate = 86400;

export async function GET() {
  const body =
`# MacroStance
> MacroStance aggregates real-time financial news and market intelligence across equities, macro, forex, commodities, crypto, geopolitics, and tech — built for traders, analysts, and market observers.

Updated continuously. Sourced from 50+ providers including Reuters, Bloomberg, WSJ, and CNBC.

## Coverage

- [Markets](${SITE_URL}/markets): Curated digest of equities, macro, and cross-asset market headlines.
- [Geopolitics](${SITE_URL}/geopolitics): AI-synthesised geopolitical briefings and global risk signals.
- [Tech](${SITE_URL}/tech): Technology sector news covering semiconductors, AI, and big tech.

## Live Feed

- [Home — Full Feed](${SITE_URL}/): Real-time headlines across all categories, updated continuously.

## About

- [About](${SITE_URL}/about): MacroStance mission, editorial approach, and team.
- [Data Sources](${SITE_URL}/data-sources): Full list of news providers and data partners.
- [Editorial Standards](${SITE_URL}/editorial-standards): Editorial policy and AI-use disclosure.

## Optional

- [Contact](${SITE_URL}/contact): Contact the MacroStance editorial team.
- [Disclaimer](${SITE_URL}/disclaimer): Legal disclaimer for financial information.
- [Privacy](${SITE_URL}/privacy): Privacy policy.
- [Terms](${SITE_URL}/terms): Terms of service.`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}

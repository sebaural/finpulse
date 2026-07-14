import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/seo';

export const revalidate = 86400;

export async function GET() {
  const body =
`# MacroStance
> MacroStance aggregates real-time financial news and market intelligence across equities, macro, forex, commodities, crypto, geopolitics, and tech — built for traders, analysts, and market observers.
> This file is intended for AI agents and LLM crawlers and describes the site's access policy for automated systems.

Updated continuously. Sourced from 50+ providers including Reuters, Bloomberg, WSJ, and CNBC.

## AI Crawler Access Policy

Access for AI agents and search engines is open and configured at the edge/WAF level (Cloudflare).
36 AI/search crawlers have been whitelisted and receive a normal \`200 OK\` response without a Cloudflare Challenge / CAPTCHA / JS verification.

Allowed crawlers:

- GPTBot
- ChatGPT-User
- OAI-SearchBot
- ClaudeBot
- Claude-Web
- anthropic-ai
- PerplexityBot
- Perplexity-User
- Google-Extended
- Googlebot
- Bingbot
- BingPreview
- CCBot
- cohere-ai
- Amazonbot
- Applebot
- Applebot-Extended
- Bytespider
- YandexBot
- DuckDuckBot
- facebookexternalhit
- Meta-ExternalAgent
- Meta-ExternalFetcher
- Twitterbot
- LinkedInBot
- Diffbot
- MJ12bot
- SemrushBot
- AhrefsBot
- DotBot
- Timpibot
- ImagesiftBot
- YouBot
- Omgilibot
- FriendlyCrawler
- Webzio-Extended

## Coverage

- [Markets](${SITE_URL}/markets): Curated digest of equities, macro, and cross-asset market headlines.
- [Geopolitics](${SITE_URL}/geopolitics): AI-synthesised geopolitical briefings and global risk signals.
- [Tech](${SITE_URL}/tech): Technology sector news covering semiconductors, AI, and big tech.

## Live Feed

- [Live Feed — Full Feed](${SITE_URL}/live-feed): Real-time headlines across all categories, updated continuously.
- [Home](${SITE_URL}/): Landing page featuring the News Pulse, Deep-Dive Analysis, and The Macro Landscape blocks.

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

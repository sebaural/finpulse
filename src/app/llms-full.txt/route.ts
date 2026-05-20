import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo';

export const revalidate = 3600;

type ArticleRow = {
  title: string;
  slug: string;
  summary: string;
  keyPoints: unknown;
  region: string;
  tags: unknown;
  date: string;
  createdAt: Date;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
}

function articleSection(section: string, row: ArticleRow): string {
  const slug = row.slug || row.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  const url = `${SITE_URL}/${section}/${slug}`;
  const keyPoints = safeStringArray(row.keyPoints);
  const tags = safeStringArray(row.tags);

  const lines: string[] = [
    `## ${row.title}`,
    ``,
    `URL: ${url}`,
    `Date: ${row.date}`,
    `Region: ${row.region}`,
    tags.length ? `Tags: ${tags.join(', ')}` : '',
    ``,
    row.summary,
  ].filter((l) => l !== undefined);

  if (keyPoints.length) {
    lines.push('', '**Key Points:**');
    keyPoints.forEach((pt) => lines.push(`- ${pt}`));
  }

  return lines.join('\n');
}

function buildStaticPages(): string[] {
  return [
    `## Home\n\nMacroStance delivers real-time global financial news, market data, and geopolitical intelligence for traders, analysts, and market observers worldwide.\n\nURL: ${SITE_URL}/`,

    `## Geopolitics\n\nAI-synthesised geopolitical briefings drawn from 50+ trusted international news sources. Updated daily.\n\nURL: ${SITE_URL}/geopolitics`,

    `## Markets\n\nMarket-moving news and cross-asset analysis covering equities, forex, commodities, and macro.\n\nURL: ${SITE_URL}/markets`,

    `## Tech\n\nTechnology sector news and market impact analysis, from AI developments to semiconductor trends.\n\nURL: ${SITE_URL}/tech`,

    `## About\n\nMacroStance is an independent financial newsroom aggregating high-signal headlines and market data without conflicts of interest.\n\nURL: ${SITE_URL}/about`,

    `## Editorial Standards\n\nMacroStance editorial and AI-use policy — how articles are sourced, synthesised, and reviewed.\n\nURL: ${SITE_URL}/editorial-standards`,

    `## Data Sources\n\nThe news providers and data partners powering MacroStance coverage.\n\nURL: ${SITE_URL}/data-sources`,
  ];
}

// ── Route Handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const select = {
    title: true,
    slug: true,
    summary: true,
    keyPoints: true,
    region: true,
    tags: true,
    date: true,
    createdAt: true,
  } as const;
  const order = { orderBy: { createdAt: 'desc' as const }, take: 100 };

  let geopolitics: ArticleRow[] = [];
  let markets: ArticleRow[] = [];
  let tech: ArticleRow[] = [];

  try {
    [geopolitics, markets, tech] = await Promise.all([
      prisma.geopoliticsArticle.findMany({ select, ...order }),
      prisma.marketsArticle.findMany({ select, ...order }),
      prisma.techArticle.findMany({ select, ...order }),
    ]);
  } catch (err) {
    console.error('[llms-full.txt] DB error:', err);
  }

  const header =
    `# ${SITE_NAME} — Full Text\n\n` +
    `> ${SITE_DESCRIPTION}\n` +
    `> Source: ${SITE_URL}\n` +
    `> Generated: ${new Date().toISOString()}`;

  const geopoliticsHeading = geopolitics.length
    ? [`## Geopolitics Briefings\n\n_${geopolitics.length} briefing(s) below, newest first._`, ...geopolitics.map((r) => articleSection('geopolitics', r))]
    : [];

  const marketsHeading = markets.length
    ? [`## Markets Analysis\n\n_${markets.length} article(s) below, newest first._`, ...markets.map((r) => articleSection('markets', r))]
    : [];

  const techHeading = tech.length
    ? [`## Tech Sector Analysis\n\n_${tech.length} article(s) below, newest first._`, ...tech.map((r) => articleSection('tech', r))]
    : [];

  const allSections = [
    header,
    ...buildStaticPages(),
    ...geopoliticsHeading,
    ...marketsHeading,
    ...techHeading,
  ];

  const body = allSections.join('\n\n---\n\n');

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/seo';

export const revalidate = 3600;

type ArticleRow = { title: string; slug: string; summary: string };

function articleLine(section: string, row: ArticleRow): string {
  const slug = row.slug || row.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  return `- [${row.title}](${SITE_URL}/${section}/${slug}): ${row.summary.replace(/\n/g, ' ').slice(0, 120).trimEnd()}…`;
}

function buildSection(heading: string, rows: ArticleRow[], section: string): string {
  if (!rows.length) return '';
  return `## ${heading}\n\n${rows.map((r) => articleLine(section, r)).join('\n')}`;
}

export async function GET() {
  const select = { title: true, slug: true, summary: true } as const;
  const order = { orderBy: { createdAt: 'desc' as const }, take: 50 };

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
    console.error('[llms.txt] DB error:', err);
  }

  const sections = [
    `## Pages\n\n` +
      `- [Home](${SITE_URL}/): Real-time global financial news headlines and market intelligence.\n` +
      `- [Geopolitics](${SITE_URL}/geopolitics): AI-synthesised geopolitical briefings updated daily.\n` +
      `- [Markets](${SITE_URL}/markets): Market-moving news and cross-asset analysis.\n` +
      `- [Tech](${SITE_URL}/tech): Technology sector news and market impact analysis.\n` +
      `- [About](${SITE_URL}/about): About MacroStance and its editorial approach.\n` +
      `- [Data Sources](${SITE_URL}/data-sources): News providers and data partners used by MacroStance.\n` +
      `- [Editorial Standards](${SITE_URL}/editorial-standards): Editorial and AI-use policy.\n` +
      `- [Contact](${SITE_URL}/contact): Contact the MacroStance team.\n` +
      `- [Disclaimer](${SITE_URL}/disclaimer): Legal disclaimer.\n` +
      `- [Privacy](${SITE_URL}/privacy): Privacy policy.\n` +
      `- [Terms](${SITE_URL}/terms): Terms of service.`,
    buildSection('Geopolitics Briefings', geopolitics, 'geopolitics'),
    buildSection('Markets Analysis', markets, 'markets'),
    buildSection('Tech Sector Analysis', tech, 'tech'),
  ].filter(Boolean);

  const body =
    `# ${SITE_NAME}\n\n` +
    `> ${SITE_DESCRIPTION}\n\n` +
    sections.join('\n\n');

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}

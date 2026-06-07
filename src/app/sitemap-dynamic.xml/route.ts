import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { SITE_URL } from '@/lib/seo';
import { toSlug } from '@/lib/summary-pipeline';

// Revalidate every 12 hours on Vercel
export const revalidate = 43200;

type ArticleRow = { slug: string; title: string; updatedAt: Date };

function buildEntry(
  section: 'geopolitics' | 'markets' | 'tech',
  row: ArticleRow,
): string {
  const slug = row.slug || toSlug(row.title);
  const loc = `${SITE_URL}/${section}/${slug}`;
  const mod = row.updatedAt.toISOString();
  return (
    `  <url>\n` +
    `    <loc>${loc}</loc>\n` +
    `    <lastmod>${mod}</lastmod>\n` +
    `    <changefreq>daily</changefreq>\n` +
    `    <priority>0.7</priority>\n` +
    `  </url>\n`
  );
}

export async function GET() {
  try {
    const prisma = getPrisma();
    const select = { slug: true, title: true, updatedAt: true } as const;

    const [geopolitics, markets, tech] = await Promise.all([
      prisma.geopoliticsArticle.findMany({ select, orderBy: { updatedAt: 'desc' } }),
      prisma.marketsArticle.findMany({ select, orderBy: { updatedAt: 'desc' } }),
      prisma.techArticle.findMany({ select, orderBy: { updatedAt: 'desc' } }),
    ]);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += geopolitics.map((r) => buildEntry('geopolitics', r)).join('');
    xml += markets.map((r) => buildEntry('markets', r)).join('');
    xml += tech.map((r) => buildEntry('tech', r)).join('');
    xml += `</urlset>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    console.error('[sitemap-dynamic] failed to generate:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
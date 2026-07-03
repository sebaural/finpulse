import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { SITE_URL, SITE_NAME } from '@/lib/seo';
import { toSlug } from '@/lib/summary-pipeline';

// Google News sitemap. Unlike the standard sitemap, Google News only considers
// articles published in the last ~2 days, so we keep this window tight and
// revalidate frequently. Referenced from robots.ts.
export const revalidate = 900; // 15 minutes

const PUBLICATION_LANGUAGE = 'en';
const NEWS_WINDOW_MS = 2 * 24 * 60 * 60 * 1000; // last 2 days
const MAX_URLS = 1000; // Google News sitemap hard limit

type NewsRow = { slug: string; title: string; tags: unknown; createdAt: Date };
type PulseNewsRow = {
  pulseSlug: string;
  articleSlug: string;
  title: string;
  category: string;
  createdAt: Date;
};

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildEntry(
  section: 'geopolitics' | 'markets' | 'tech',
  row: NewsRow,
): string {
  const slug = row.slug || toSlug(row.title);
  const loc = `${SITE_URL}/${section}/${slug}`;
  const publicationDate = row.createdAt.toISOString();
  const tags = Array.isArray(row.tags) ? (row.tags as string[]) : [];
  const keywords = xmlEscape(tags.join(', '));

  return (
    `  <url>\n` +
    `    <loc>${loc}</loc>\n` +
    `    <news:news>\n` +
    `      <news:publication>\n` +
    `        <news:name>${xmlEscape(SITE_NAME)}</news:name>\n` +
    `        <news:language>${PUBLICATION_LANGUAGE}</news:language>\n` +
    `      </news:publication>\n` +
    `      <news:publication_date>${publicationDate}</news:publication_date>\n` +
    `      <news:title>${xmlEscape(row.title)}</news:title>\n` +
    (keywords ? `      <news:keywords>${keywords}</news:keywords>\n` : ``) +
    `    </news:news>\n` +
    `  </url>\n`
  );
}

export async function GET() {
  try {
    const prisma = getPrisma();
    const cutoff = new Date(Date.now() - NEWS_WINDOW_MS);
    const select = { slug: true, title: true, tags: true, createdAt: true } as const;
    const where = { createdAt: { gte: cutoff } };
    const orderBy = { createdAt: 'desc' as const };

    const pulseSelect = {
      pulseSlug: true,
      articleSlug: true,
      title: true,
      category: true,
      createdAt: true,
    } as const;

    const [geopolitics, markets, tech, pulse] = await Promise.all([
      prisma.geopoliticsArticle.findMany({ select, where, orderBy }),
      prisma.marketsArticle.findMany({ select, where, orderBy }),
      prisma.techArticle.findMany({ select, where, orderBy }),
      prisma.pulseArticle.findMany({ select: pulseSelect, where, orderBy }),
    ]);

    const entries = [
      ...geopolitics.map((r) => buildEntry('geopolitics', r)),
      ...markets.map((r) => buildEntry('markets', r)),
      ...tech.map((r) => buildEntry('tech', r)),
      ...pulse.map((r: PulseNewsRow) => {
        const loc = `${SITE_URL}/pulse/${r.pulseSlug}/${r.articleSlug}`;
        const publicationDate = r.createdAt.toISOString();
        const keywords = xmlEscape([r.category, r.pulseSlug].join(', '));
        return (
          `  <url>\n` +
          `    <loc>${loc}</loc>\n` +
          `    <news:news>\n` +
          `      <news:publication>\n` +
          `        <news:name>${xmlEscape(SITE_NAME)}</news:name>\n` +
          `        <news:language>${PUBLICATION_LANGUAGE}</news:language>\n` +
          `      </news:publication>\n` +
          `      <news:publication_date>${publicationDate}</news:publication_date>\n` +
          `      <news:title>${xmlEscape(r.title)}</news:title>\n` +
          `      <news:keywords>${keywords}</news:keywords>\n` +
          `    </news:news>\n` +
          `  </url>\n`
        );
      }),
    ].slice(0, MAX_URLS);

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml +=
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
      `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n`;
    xml += entries.join('');
    xml += `</urlset>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=60',
      },
    });
  } catch (err) {
    console.error('[sitemap-news] failed to generate:', err);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

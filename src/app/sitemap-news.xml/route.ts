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

function buildPulseEntry(row: PulseNewsRow): string {
  const loc = `${SITE_URL}/pulse/${row.pulseSlug}/${row.articleSlug}`;
  const publicationDate = row.createdAt.toISOString();
  const keywords = xmlEscape([row.category, row.pulseSlug].join(', '));
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
    `      <news:keywords>${keywords}</news:keywords>\n` +
    `    </news:news>\n` +
    `  </url>\n`
  );
}

// Runs one query in isolation. If it fails, logs which section broke and
// returns an empty array instead of throwing — so a single bad table or
// connection can only ever drop that section's URLs from the feed, never
// take down the whole news sitemap. Same pattern as sitemap-dynamic.xml.
async function safeQuery<T>(label: string, fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[sitemap-news] failed to load "${label}" rows, omitting from feed`, err);
    return [];
  }
}

export async function GET() {
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

  // Each section fetched independently — a failure in any one of these
  // can never take down the others, since safeQuery already caught it
  // and this Promise.all can therefore never reject.
  const [geopolitics, markets, tech, pulse] = await Promise.all([
    safeQuery<NewsRow>('geopolitics', () =>
      prisma.geopoliticsArticle.findMany({ select, where, orderBy }),
    ),
    safeQuery<NewsRow>('markets', () =>
      prisma.marketsArticle.findMany({ select, where, orderBy }),
    ),
    safeQuery<NewsRow>('tech', () =>
      prisma.techArticle.findMany({ select, where, orderBy }),
    ),
    safeQuery<PulseNewsRow>('pulse', () =>
      prisma.pulseArticle.findMany({ select: pulseSelect, where, orderBy }),
    ),
  ]);

  const entries = [
    ...geopolitics.map((r) => buildEntry('geopolitics', r)),
    ...markets.map((r) => buildEntry('markets', r)),
    ...tech.map((r) => buildEntry('tech', r)),
    ...pulse.map(buildPulseEntry),
  ].slice(0, MAX_URLS);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml +=
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n`;
  xml += entries.join('');
  xml += `</urlset>`;

  // No top-level try/catch needed — every query that can fail is already
  // isolated in safeQuery above, so nothing between here and the response
  // can throw.
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=60',
    },
  });
}

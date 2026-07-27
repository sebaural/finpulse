import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { SITE_URL, formatDateSegment } from '@/lib/seo';
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

type TopicArticleRow = { slug: string; updatedAt: Date; topic: { slug: string } | null };

type PulseRow = { pulseSlug: string; articleSlug: string; updatedAt: Date };

function buildPulseEntry(row: PulseRow): string {
  const loc = `${SITE_URL}/pulse/${row.pulseSlug}/${row.articleSlug}`;
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

// OverviewArticle is a separate table/pipeline (per Step 2 of the guide),
// so it gets its own row type and its own entry builder rather than reusing
// buildEntry — its URL shape includes a date segment that the other
// sections (geopolitics/markets/tech) don't have.
type OverviewArticleRow = { slug: string; title: string; publishedDate: Date };

function buildOverviewEntry(row: OverviewArticleRow): string {
  const slug = row.slug || toSlug(row.title);
  const loc = `${SITE_URL}/overview/${formatDateSegment(row.publishedDate)}/${slug}`;
  const mod = row.publishedDate.toISOString();
  return (
    `  <url>\n` +
    `    <loc>${loc}</loc>\n` +
    `    <lastmod>${mod}</lastmod>\n` +
    `    <changefreq>never</changefreq>\n` +
    `    <priority>0.8</priority>\n` +
    `  </url>\n`
  );
}

function buildTopicEntry(row: TopicArticleRow): string {
  if (!row.topic || !row.slug) return '';
  const loc = `${SITE_URL}/topics/${row.topic.slug}/${row.slug}`;
  const mod = row.updatedAt.toISOString();
  return (
    `  <url>\n` +
    `    <loc>${loc}</loc>\n` +
    `    <lastmod>${mod}</lastmod>\n` +
    `    <changefreq>weekly</changefreq>\n` +
    `    <priority>0.8</priority>\n` +
    `  </url>\n`
  );
}

// Runs one query in isolation. If it fails, logs the error with a tag
// identifying which section broke and returns an empty array instead of
// throwing — so one bad table/connection can only ever drop that section's
// URLs from the sitemap, never take down the whole response.
async function safeQuery<T>(label: string, fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[sitemap-dynamic] failed to load "${label}" rows, omitting from sitemap`, err);
    return [];
  }
}

export async function GET() {
  const prisma = getPrisma();
  const select = { slug: true, title: true, updatedAt: true } as const;

  const topicSelect = {
    slug: true,
    updatedAt: true,
    topic: { select: { slug: true } },
  } as const;
  const topicWhere = { NOT: { topicId: null } } as const;

  const pulseSelect = {
    pulseSlug: true,
    articleSlug: true,
    updatedAt: true,
  } as const;

  const overviewSelect = {
    slug: true,
    title: true,
    publishedDate: true,
  } as const;

  // Each section is fetched independently via safeQuery, and all of them run
  // concurrently via Promise.all around the already-caught promises — so
  // this Promise.all can never reject, since every individual promise
  // resolves to either real rows or an empty array on failure.
  const [geopolitics, markets, tech, pulse, geoTopics, marketTopics, techTopics, overview] =
    await Promise.all([
      safeQuery<ArticleRow>('geopolitics', () =>
        prisma.geopoliticsArticle.findMany({ select, orderBy: { updatedAt: 'desc' } }),
      ),
      safeQuery<ArticleRow>('markets', () =>
        prisma.marketsArticle.findMany({ select, orderBy: { updatedAt: 'desc' } }),
      ),
      safeQuery<ArticleRow>('tech', () =>
        prisma.techArticle.findMany({ select, orderBy: { updatedAt: 'desc' } }),
      ),
      safeQuery<PulseRow>('pulse', () =>
        prisma.pulseArticle.findMany({ select: pulseSelect, orderBy: { updatedAt: 'desc' } }),
      ),
      safeQuery<TopicArticleRow>('geopolitics-topics', () =>
        prisma.geopoliticsArticle.findMany({ where: topicWhere, select: topicSelect }),
      ),
      safeQuery<TopicArticleRow>('markets-topics', () =>
        prisma.marketsArticle.findMany({ where: topicWhere, select: topicSelect }),
      ),
      safeQuery<TopicArticleRow>('tech-topics', () =>
        prisma.techArticle.findMany({ where: topicWhere, select: topicSelect }),
      ),
      safeQuery<OverviewArticleRow>('overview', () =>
        prisma.overviewArticle.findMany({ select: overviewSelect, orderBy: { publishedDate: 'desc' } }),
      ),
    ]);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  xml += geopolitics.map((r) => buildEntry('geopolitics', r)).join('');
  xml += markets.map((r) => buildEntry('markets', r)).join('');
  xml += tech.map((r) => buildEntry('tech', r)).join('');
  xml += pulse.map(buildPulseEntry).join('');
  xml += [...geoTopics, ...marketTopics, ...techTopics].map(buildTopicEntry).join('');
  xml += overview.map(buildOverviewEntry).join('');
  xml += `</urlset>`;

  // Note: the route itself no longer has a top-level try/catch. It doesn't
  // need one — every query that can fail is already isolated in safeQuery
  // above, so nothing between here and the response can throw. If it ever
  // did, letting Next.js return its own 500 is preferable to silently
  // returning malformed XML with a 200 status.
  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=43200, stale-while-revalidate=60',
    },
  });
}

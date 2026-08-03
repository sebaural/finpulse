import type { MetadataRoute } from 'next';
import { SITE_URL, formatDateSegment } from '@/lib/seo';
import { getPrisma } from '@/lib/db';
import { toSlug } from '@/lib/summary-pipeline';

export const revalidate = 3600;

type ArticleRow = { slug: string; title: string; updatedAt: Date };
type OverviewArticleRow = { slug: string; title: string; publishedDate: Date };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`,                    lastModified: now, changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${SITE_URL}/geopolitics`,         lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE_URL}/markets`,             lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE_URL}/tech`,                lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE_URL}/about`,               lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/editorial-standards`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/data-sources`,        lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/contact`,             lastModified: now, changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${SITE_URL}/disclaimer`,          lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${SITE_URL}/privacy`,             lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${SITE_URL}/terms`,               lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
  ];

  let articleEntries: MetadataRoute.Sitemap = [];
  let overviewEntries: MetadataRoute.Sitemap = [];

  try {
    const prisma = getPrisma();
    const select = { slug: true, title: true, updatedAt: true } as const;
    // topicId: null — topic-linked articles canonicalize to /topics/... and are
    // submitted there via sitemap-dynamic.xml instead, so we don't list the
    // same content twice across sitemaps.
    const [geopolitics, markets, tech] = await Promise.all([
      prisma.geopoliticsArticle.findMany({ where: { topicId: null }, select, orderBy: { updatedAt: 'desc' } }),
      prisma.marketsArticle.findMany({ where: { topicId: null }, select, orderBy: { updatedAt: 'desc' } }),
      prisma.techArticle.findMany({ where: { topicId: null }, select, orderBy: { updatedAt: 'desc' } }),
    ]);

    const toEntry = (section: 'geopolitics' | 'markets' | 'tech') => (row: ArticleRow) => ({
      url: `${SITE_URL}/${section}/${row.slug || toSlug(row.title)}`,
      lastModified: row.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    });

    articleEntries = [
      ...geopolitics.map(toEntry('geopolitics')),
      ...markets.map(toEntry('markets')),
      ...tech.map(toEntry('tech')),
    ];
  } catch (err) {
    console.error('[sitemap] failed to load article rows, returning static entries only', err);
  }

  // OverviewArticle is queried separately from the block above — it's an
  // independent table/pipeline (per Step 2), so a failure here shouldn't be
  // able to blank out the geopolitics/markets/tech entries, or vice versa.
  try {
    const prisma = getPrisma();
    const overviewSelect = { slug: true, title: true, publishedDate: true } as const;
    const overview = await prisma.overviewArticle.findMany({
      select: overviewSelect,
      orderBy: { publishedDate: 'desc' },
    });

    overviewEntries = overview.map((row: OverviewArticleRow) => ({
      url: `${SITE_URL}/overview/${formatDateSegment(row.publishedDate)}/${row.slug || toSlug(row.title)}`,
      lastModified: row.publishedDate,
      changeFrequency: 'never' as const,
      priority: 0.8,
    }));
  } catch (err) {
    console.error('[sitemap] failed to load overview article rows, returning without them', err);
  }

  return [...staticEntries, ...articleEntries, ...overviewEntries];
}


import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';
import { prisma } from '@/lib/db';
import { toSlug } from '@/lib/geopolitics-service';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

type ArticleRow = { title: string; updatedAt: Date };

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

  try {
    const select = { title: true, updatedAt: true } as const;
    const [geopolitics, markets, tech] = await Promise.all([
      prisma.summaryArticle.findMany({ select, orderBy: { updatedAt: 'desc' } }),
      prisma.marketsArticle.findMany({ select, orderBy: { updatedAt: 'desc' } }),
      prisma.techArticle.findMany({ select, orderBy: { updatedAt: 'desc' } }),
    ]);

    const toEntry = (section: 'geopolitics' | 'markets' | 'tech') => (row: ArticleRow) => ({
      url: `${SITE_URL}/${section}/${toSlug(row.title)}`,
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

  return [...staticEntries, ...articleEntries];
}

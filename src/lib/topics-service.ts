// src/lib/topics-service.ts

import { cache } from 'react';
import { getPrisma } from '@/lib/db';

type Vertical = 'geopolitics' | 'markets' | 'tech';

/**
 * Fetch a single article by slug, with optional vertical hint.
 *
 * Wrapped in React cache() — generateMetadata and the page component both call
 * this with the same slug; cache() deduplicates to a single DB round-trip per
 * render.
 *
 * Pass `vertical` when known to skip unnecessary table scans. Omit `vertical`
 * for exhaustive cross-table fallback (e.g. direct URL access).
 *
 * NOTE: `slug` is not a unique column in this schema (it has @default("")), so
 * lookups use findFirst — consistent with every other service in src/lib.
 */
export const fetchArticleBySlug = cache(async (slug: string, vertical?: Vertical) => {
  const prisma = getPrisma();

  if (vertical === 'geopolitics' || !vertical) {
    const geo = await prisma.geopoliticsArticle.findFirst({
      where: { slug },
      include: { topic: true },
    });
    if (geo) return { data: geo, type: 'geopolitics' as const };
  }

  if (vertical === 'markets' || !vertical) {
    const mkt = await prisma.marketsArticle.findFirst({
      where: { slug },
      include: { topic: true },
    });
    if (mkt) return { data: mkt, type: 'markets' as const };
  }

  if (vertical === 'tech' || !vertical) {
    const tech = await prisma.techArticle.findFirst({
      where: { slug },
      include: { topic: true },
    });
    if (tech) return { data: tech, type: 'tech' as const };
  }

  return null;
});

/**
 * Fetch a topic by slug together with all of its linked articles across the
 * three verticals. Cache-wrapped so generateMetadata and the hub page share a
 * single round-trip. Returns null when the topic does not exist.
 */
export const fetchTopicBySlug = cache(async (slug: string) => {
  const prisma = getPrisma();
  return prisma.topic.findUnique({
    where: { slug },
    include: {
      geopoliticsArticles: {
        select: { slug: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      marketsArticles: {
        select: { slug: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
      techArticles: {
        select: { slug: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
});

/**
 * Fetch topic-linked articles for the homepage editorial grid.
 * Includes the latest topic-linked articles across all homepage verticals.
 */
export async function fetchTopicAnalysis() {
  const prisma = getPrisma();
  const [geoAnalysis, marketAnalysis, techAnalysis] = await Promise.all([
    prisma.geopoliticsArticle.findMany({
      where: { NOT: { topicId: null } },
      take: 3,
      include: { topic: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.marketsArticle.findMany({
      where: { NOT: { topicId: null } },
      take: 3,
      include: { topic: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.techArticle.findMany({
      where: { NOT: { topicId: null } },
      take: 3,
      include: { topic: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);
  return { geoAnalysis, marketAnalysis, techAnalysis };
}

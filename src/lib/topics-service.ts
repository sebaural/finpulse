// src/lib/topics-service.ts

import { cache } from 'react';
import { getPrisma } from '@/lib/db';

type Vertical = 'geopolitics' | 'markets' | 'tech';

interface TopicAnalysisItem {
  id: string;
  slug: string;
  title: string;
  createdAt: Date;
  topic: { slug: string; name: string };
}

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
 * Returns one latest linked article per topic, sorted by recency.
 */
export async function fetchTopicAnalysis() {
  const prisma = getPrisma();
  const topics = await prisma.topic.findMany({
    include: {
      geopoliticsArticles: {
        select: { id: true, slug: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      marketsArticles: {
        select: { id: true, slug: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      techArticles: {
        select: { id: true, slug: true, title: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  const topicAnalysis = topics
    .map<TopicAnalysisItem | null>((topic) => {
      const latest = [
        ...topic.geopoliticsArticles,
        ...topic.marketsArticles,
        ...topic.techArticles,
      ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

      if (!latest) return null;

      return {
        id: latest.id,
        slug: latest.slug,
        title: latest.title,
        createdAt: latest.createdAt,
        topic: {
          slug: topic.slug,
          name: topic.name,
        },
      };
    })
    .filter((item): item is TopicAnalysisItem => item !== null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { topicAnalysis };
}

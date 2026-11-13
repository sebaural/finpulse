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

export interface StorylineSource {
  source?: string;
  url: string;
  title?: string;
  /** YYYY-MM-DD of the briefing that cited it. */
  date: string;
}

/**
 * Sources across a topic's storyline: the current briefing's sources plus
 * those of the previous `previous` briefings in the same topic (all verticals),
 * deduped by URL, newest first. Shown on /topics article pages instead of the
 * single-briefing source list used by the legacy /{vertical}/{slug} page.
 */
export async function fetchStorylineSources(
  topicId: string,
  current: { date: string; createdAt: Date; sourceArticles: unknown },
  previous = 4,
  cap = 12,
): Promise<StorylineSource[]> {
  type Row = { date: string; createdAt: Date; sourceArticles: unknown };
  let earlier: Row[] = [];
  try {
    const prisma = getPrisma();
    const args = {
      where: { topicId, createdAt: { lt: current.createdAt } },
      select: { date: true, createdAt: true, sourceArticles: true },
      orderBy: { createdAt: 'desc' as const },
      take: previous,
    };
    const [geo, mkt, tech] = await Promise.all([
      prisma.geopoliticsArticle.findMany(args),
      prisma.marketsArticle.findMany(args),
      prisma.techArticle.findMany(args),
    ]);
    earlier = [...geo, ...mkt, ...tech]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, previous);
  } catch (error) {
    console.error('[topics-service] failed to load storyline sources', error);
  }

  const seen = new Set<string>();
  const out: StorylineSource[] = [];
  for (const row of [current, ...earlier]) {
    const list = Array.isArray(row.sourceArticles) ? row.sourceArticles : [];
    for (const raw of list as Array<{ url?: unknown; title?: unknown; source?: unknown }>) {
      const url = typeof raw?.url === 'string' ? raw.url.trim() : '';
      if (!url || url.includes('rt.com')) continue;
      const key = url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        url,
        title: typeof raw.title === 'string' ? raw.title : undefined,
        source: typeof raw.source === 'string' ? raw.source : undefined,
        date: row.date,
      });
      if (out.length >= cap) return out;
    }
  }
  return out;
}

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

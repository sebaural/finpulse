// src/lib/related-service.ts

import { getPrisma } from '@/lib/db';
import { canonicalizeSlug, toSlug } from '@/lib/summary-pipeline';
import { truncateDescription } from '@/lib/stripMarkdown';

export type BriefingSection = 'geopolitics' | 'markets' | 'tech';

export interface RelatedBriefing {
  section: BriefingSection;
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  region: string;
  topicSlug: string | null;
}

interface RelatedRow {
  slug: string;
  title: string;
  summary: string;
  tags: unknown;
  region: string;
  date: string;
  createdAt: Date;
  topic: { slug: string } | null;
}

// Pull a recent window from each section to score against; far more than we
// need, but bounded so the query stays cheap.
const POOL_PER_SECTION = 40;

function normalizeTags(tags: unknown): string[] {
  return Array.isArray(tags) ? (tags as string[]).map((t) => String(t).toLowerCase()) : [];
}

/**
 * Returns briefings related to the current one, ranked by shared-tag overlap
 * and then recency, drawn from ALL sections. Falls back to recent briefings
 * when no tag overlap exists, so an article is never left without internal
 * links. Returns [] on any failure (callers render nothing).
 */
export async function getRelatedBriefings(
  currentSlug: string,
  currentTags: string[],
  limit = 4,
): Promise<RelatedBriefing[]> {
  try {
    const prisma = getPrisma();
    const select = {
      slug: true,
      title: true,
      summary: true,
      tags: true,
      region: true,
      date: true,
      createdAt: true,
      topic: { select: { slug: true } },
    } as const;
    const query = { select, orderBy: { createdAt: 'desc' as const }, take: POOL_PER_SECTION };

    const [geopolitics, markets, tech] = await Promise.all([
      prisma.geopoliticsArticle.findMany(query),
      prisma.marketsArticle.findMany(query),
      prisma.techArticle.findMany(query),
    ]);

    const target = canonicalizeSlug(currentSlug);
    const wanted = new Set(currentTags.map((t) => t.toLowerCase()));

    interface Scored {
      briefing: RelatedBriefing;
      score: number;
      createdAt: number;
    }
    const pool: Scored[] = [];

    const collect = (section: BriefingSection, rows: RelatedRow[]) => {
      for (const row of rows) {
        const slug = canonicalizeSlug(row.slug || toSlug(row.title));
        if (slug === target) continue; // never relate an article to itself
        const score = normalizeTags(row.tags).reduce(
          (n, tag) => (wanted.has(tag) ? n + 1 : n),
          0,
        );
        pool.push({
          briefing: {
            section,
            slug,
            title: row.title,
            excerpt: truncateDescription(row.summary, 140),
            date: row.date,
            region: row.region,
            topicSlug: row.topic?.slug ?? null,
          },
          score,
          createdAt: row.createdAt.getTime(),
        });
      }
    };

    collect('geopolitics', geopolitics);
    collect('markets', markets);
    collect('tech', tech);

    pool.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);

    // Two rows in the same section can canonicalize to the same slug (e.g. a
    // republished briefing, or a title that toSlug()s identically). That would
    // yield duplicate section+slug entries and collide on the React key in
    // RelatedBriefings. Dedupe here, keeping the first (highest-scoring /
    // most-recent) occurrence per section+slug.
    const seen = new Set<string>();
    const deduped: Scored[] = [];
    for (const p of pool) {
      const key = `${p.briefing.section}-${p.briefing.slug}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(p);
    }

    return deduped.slice(0, limit).map((p) => p.briefing);
  } catch (err) {
    console.error('[related-service] failed to load related briefings', err);
    return [];
  }
}

import Parser from 'rss-parser';
import type { OverviewCategorySlug } from './overview-categories';

const parser = new Parser();

interface NewsFeedDescriptor {
  url: string;
  // Set only for feeds dedicated to one region (e.g. BBC's per-region World
  // feeds) — general "World" feeds leave this undefined and rely on
  // downstream keyword filtering + LLM classification instead.
  regionHint?: OverviewCategorySlug;
}

const NEWS_FEEDS: NewsFeedDescriptor[] = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { url: 'https://www.economist.com/latest/rss.xml' },
  { url: 'http://rss.cnn.com/rss/edition.rss' },
  { url: 'https://www.theguardian.com/world/rss' },
  { url: 'https://feeds.npr.org/1001/rss.xml' },
  // Dedicated per-region feeds so every OVERVIEW_CATEGORY_SLUGS region has
  // reliable daily raw material, instead of depending on a general "World"
  // editor happening to feature it that day.
  { url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml', regionHint: 'us' },
  { url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml', regionHint: 'east-asia' },
  { url: 'https://feeds.bbci.co.uk/news/world/middle_east/rss.xml', regionHint: 'middle-east' },
  { url: 'https://feeds.bbci.co.uk/news/world/europe/rss.xml', regionHint: 'europe' },
  { url: 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', regionHint: 'africa' },
];

export interface RawStory {
  title: string;
  url: string;
  source: string;
  publishedAt: Date;
  snippet: string; // RSS teaser text only — never scraped full article body
  regionHint?: OverviewCategorySlug;
}

export async function fetchWorldNewsFeeds(): Promise<RawStory[]> {
  const results = await Promise.allSettled(
    NEWS_FEEDS.map(async ({ url: feedUrl, regionHint }) => {
      // Fetch manually + parseString rather than parser.parseURL(feedUrl):
      // parseURL builds its request with the legacy, deprecated url.parse()
      // (Node DEP0169) under the hood. fetch() uses the WHATWG URL API.
      const res = await fetch(feedUrl, {
        headers: { 'User-Agent': 'rss-parser', Accept: 'application/rss+xml' },
      });
      if (!res.ok) throw new Error(`Status code ${res.status}`);
      const feed = await parser.parseString(await res.text());
      const sourceName = feed.title ?? new URL(feedUrl).hostname;

      return (feed.items ?? []).map((item): RawStory => ({
        title: item.title ?? '',
        url: item.link ?? '',
        source: sourceName,
        publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
        snippet: (item.contentSnippet ?? item.content ?? '').trim(),
        regionHint,
      }));
    })
  );

  const stories: RawStory[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') {
      stories.push(...r.value);
    } else {
      console.error('[overview-ingest] feed fetch failed:', r.reason);
    }
  }

  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  return stories.filter((s) => s.publishedAt.getTime() >= cutoff);
}

export interface StoryCluster {
  representative: RawStory;
  members: RawStory[];
  sourceCount: number;
  priority: 'high' | 'low';
  // Present when a dedicated region feed (e.g. BBC's per-region World feeds)
  // contributed a member — a general-feed story about the same event still
  // clusters with it via the title-similarity match below.
  regionHint?: OverviewCategorySlug;
}

// NOTE: an earlier version of this guide assumed src/lib/dedup.ts already
// contained reusable near-duplicate-story clustering logic. It doesn't —
// dedup.ts is unrelated, handling X-poster repost prevention (tracking the
// last-posted URL per section via Redis), not story grouping. So this is a
// small, dependency-free implementation written specifically for this
// pipeline rather than a reuse of anything else in the codebase.

const STOPWORD_MIN_LENGTH = 3; // drop very short tokens (a, to, of, ...)
const SIMILARITY_THRESHOLD = 0.5; // fraction of shared title vocabulary to count as "the same story"

function normalizeTitle(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= STOPWORD_MIN_LENGTH),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const word of a) {
    if (b.has(word)) intersection++;
  }
  const union = a.size + b.size - intersection;
  return intersection / union;
}

// Single-linkage clustering by title-word overlap: a story joins the first
// existing cluster whose "anchor" (first member) shares enough vocabulary
// with it, otherwise it starts a new cluster. Good enough for a daily batch
// of a few dozen RSS items across 3 feeds — not meant to scale beyond that.
function groupSimilarStories(stories: RawStory[]): RawStory[][] {
  const candidates = stories.map((story) => ({
    story,
    words: normalizeTitle(story.title),
  }));

  const clusters: (typeof candidates) [] = [];

  for (const candidate of candidates) {
    const match = clusters.find(
      (cluster) => jaccardSimilarity(candidate.words, cluster[0].words) >= SIMILARITY_THRESHOLD,
    );
    if (match) {
      match.push(candidate);
    } else {
      clusters.push([candidate]);
    }
  }

  return clusters.map((cluster) => cluster.map((c) => c.story));
}

export function clusterAndWeight(stories: RawStory[]): StoryCluster[] {
  const clusters = groupSimilarStories(stories); // groups of RawStory[]

  return clusters.map((members): StoryCluster => {
    const distinctSources = new Set(members.map((m) => m.source));
    const sourceCount = distinctSources.size;

    // 2+ of the 3 feeds confirming a story = high priority
    const priority: StoryCluster['priority'] = sourceCount >= 2 ? 'high' : 'low';

    // Prefer BBC/NYT phrasing as the representative snippet over CNBC
    const representative =
      members.find((m) => m.source.includes('BBC') || m.source.includes('New York Times')) ??
      members[0];

    const regionHint = members.find((m) => m.regionHint)?.regionHint;

    return { representative, members, sourceCount, priority, regionHint };
  });
}

const GEOPOLITICS_KEYWORDS = [
  'sanctions', 'election', 'military', 'diplomacy', 'border',
  'ceasefire', 'treaty', 'summit', 'coup', 'invasion', 'nato',
  'united nations', 'security council',
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary matching avoids false positives like "coup" matching inside
// an unrelated word containing that substring.
const GEOPOLITICS_KEYWORD_PATTERNS = GEOPOLITICS_KEYWORDS.map(
  (k) => new RegExp(`\\b${escapeRegExp(k)}\\b`, 'i')
);

export function isGeopoliticsRelevant(story: RawStory): boolean {
  const text = `${story.title} ${story.snippet}`;
  return GEOPOLITICS_KEYWORD_PATTERNS.some((pattern) => pattern.test(text));
}


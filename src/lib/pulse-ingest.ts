// src/lib/pulse-ingest.ts
//
// Source ingestion for Pulse: pulls world/business RSS feeds, NewsAPI and
// Finnhub general news, then sorts every story into exactly one Pulse
// category via keyword scoring (plus a per-source default). Replaces the
// GDELT /stories source, whose 100 QU/month free-plan quota repeatedly
// zeroed out generation.

import { fetchFromFinnhub, fetchFromNewsApi } from '@/lib/geopolitics-service';
import {
  clusterAndWeight,
  fetchRssStories,
  type NewsFeedDescriptor,
  type RawStory,
  type StoryCluster,
} from '@/lib/overview-ingest';
import { PULSE_SLUGS } from '@/lib/pulse-categories';
import type { SourceArticle } from '@/types/geopolitics';
import type { PulseSlug } from '@/types/pulse';

const PULSE_RSS_FEEDS: NewsFeedDescriptor[] = [
  { url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
  { url: 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml' },
  { url: 'https://www.cnbc.com/id/100003114/device/rss/rss.html' },
  { url: 'https://www.economist.com/latest/rss.xml' },
  { url: 'https://www.theguardian.com/world/rss' },
  { url: 'https://feeds.npr.org/1001/rss.xml' },
];

// 48h rather than Overview's 24h: NewsAPI's free plan serves articles with a
// delay, so a 24h window would discard most of its results.
const MAX_STORY_AGE_MS = 48 * 60 * 60 * 1000;

// One NewsAPI request per category (4/day — well under the free plan's
// 100/day). Results start with that category as their source hint.
const NEWSAPI_QUERIES: Record<PulseSlug, string> = {
  politics: 'congress OR senate OR "white house" OR election OR "supreme court"',
  economy: 'inflation OR "interest rates" OR tariffs OR "federal reserve" OR GDP',
  technology: '"artificial intelligence" OR semiconductors OR cybersecurity OR "big tech"',
  information: 'sanctions OR NATO OR "national security" OR disinformation OR "foreign policy"',
};

// Lenses match the category beats in pulse-service.ts's prompt: "information"
// is geopolitics/national security, "politics" is domestic governance.
const PULSE_KEYWORDS: Record<PulseSlug, string[]> = {
  politics: [
    'election', 'elections', 'congress', 'senate', 'senator', 'house speaker', 'lawmakers',
    'legislation', 'bill', 'white house', 'president', 'supreme court', 'governor', 'republican',
    'republicans', 'democrat', 'democrats', 'gop', 'campaign', 'ballot', 'vote', 'voters',
    'impeachment', 'parliament', 'prime minister', 'opposition', 'coalition', 'referendum',
    'shutdown', 'polls', 'mayor', 'resigns', 'resignation',
  ],
  economy: [
    'economy', 'economic', 'inflation', 'interest rate', 'interest rates', 'federal reserve', 'fed',
    'central bank', 'gdp', 'recession', 'tariff', 'tariffs', 'trade deal', 'stocks', 'stock market',
    'bond', 'bonds', 'treasury', 'jobs report', 'unemployment', 'earnings', 'oil prices', 'budget',
    'deficit', 'debt', 'tax', 'taxes', 'imf', 'wall street', 'markets', 'investors', 'dollar',
  ],
  technology: [
    'ai', 'artificial intelligence', 'chip', 'chips', 'semiconductor', 'semiconductors', 'nvidia',
    'openai', 'google', 'apple', 'microsoft', 'meta', 'amazon', 'tesla', 'tech', 'technology',
    'cyber', 'cyberattack', 'hackers', 'hacking', 'data breach', 'software', 'social media',
    'tiktok', 'platform', 'algorithm', 'quantum', 'robotics', 'startup', 'antitrust',
    'big tech', 'cybersecurity', 'datacenter', 'data center', 'anthropic',
  ],
  information: [
    'sanctions', 'nato', 'military', 'troops', 'missile', 'missiles', 'drone', 'drones', 'war',
    'ceasefire', 'invasion', 'alliance', 'treaty', 'summit', 'diplomacy', 'diplomatic',
    'foreign minister', 'foreign policy', 'national security', 'intelligence', 'espionage',
    'disinformation', 'propaganda', 'nuclear', 'border', 'united nations', 'security council',
    'coup', 'embassy', 'defense', 'defence',
  ],
};

// A source default only breaks ties between keyword-matched categories — a
// story with no keyword hits at all is dropped even if its source had a
// default (Finnhub's "general" feed carries plenty of off-beat headlines).
const SOURCE_HINT_BONUS = 1;
// Title hits outweigh snippet hits — headlines state the story's actual beat.
const TITLE_WEIGHT = 2;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KEYWORD_PATTERNS: Record<PulseSlug, RegExp[]> = Object.fromEntries(
  PULSE_SLUGS.map((slug) => [
    slug,
    PULSE_KEYWORDS[slug].map((k) => new RegExp(`\\b${escapeRegExp(k)}\\b`, 'i')),
  ]),
) as Record<PulseSlug, RegExp[]>;

interface HintedStory {
  story: RawStory;
  hint?: PulseSlug;
}

function scoreCategory(story: RawStory, slug: PulseSlug): number {
  let score = 0;
  for (const pattern of KEYWORD_PATTERNS[slug]) {
    if (pattern.test(story.title)) score += TITLE_WEIGHT;
    else if (pattern.test(story.snippet)) score += 1;
  }
  return score;
}

export function categorizeStory(story: RawStory, hint?: PulseSlug): PulseSlug | null {
  let best: PulseSlug | null = null;
  let bestScore = 0;
  for (const slug of PULSE_SLUGS) {
    const keywordScore = scoreCategory(story, slug);
    if (keywordScore === 0) continue;
    const score = keywordScore + (slug === hint ? SOURCE_HINT_BONUS : 0);
    if (score > bestScore) {
      best = slug;
      bestScore = score;
    }
  }
  return best;
}

function fromSourceArticle(a: SourceArticle): RawStory {
  return {
    title: a.title,
    url: a.url,
    source: a.source,
    publishedAt: new Date(a.publishedAt),
    snippet: (a.description ?? '').trim(),
  };
}

async function fetchNewsApiStories(): Promise<HintedStory[]> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    console.error('[pulse-ingest] NEWS_API_KEY is not set — skipping NewsAPI');
    return [];
  }
  const results = await Promise.allSettled(
    PULSE_SLUGS.map(async (slug) =>
      (await fetchFromNewsApi(apiKey, NEWSAPI_QUERIES[slug])).map(
        (a): HintedStory => ({ story: fromSourceArticle(a), hint: slug }),
      ),
    ),
  );
  return results.flatMap((r) => {
    if (r.status === 'fulfilled') return r.value;
    console.error('[pulse-ingest] NewsAPI fetch failed:', r.reason);
    return [];
  });
}

async function fetchFinnhubStories(): Promise<HintedStory[]> {
  const apiKey = process.env.FINNHUB_KEY;
  if (!apiKey) {
    console.error('[pulse-ingest] FINNHUB_KEY is not set — skipping Finnhub');
    return [];
  }
  try {
    return (await fetchFromFinnhub(apiKey)).map(
      (a): HintedStory => ({ story: fromSourceArticle(a), hint: 'economy' }),
    );
  } catch (err) {
    console.error('[pulse-ingest] Finnhub fetch failed:', err);
    return [];
  }
}

// Sites that repost or rewrite other outlets' stories (seen via NewsAPI).
// Their copies add no information and, worse, make a single-outlet story
// look multi-source corroborated to clusterAndWeight's priority scoring.
const AGGREGATOR_HOSTS = ['biztoc.com', 'newser.com', 'freerepublic.com', 'slashdot.org'];

// Outlets excluded on reliability grounds (tabloid/hyperpartisan/state media),
// so they can't become a category's headline story.
const LOW_QUALITY_HOSTS = ['dailymail.com', 'dailymail.co.uk', 'breitbart.com', 'nypost.com', 'rt.com'];

const EXCLUDED_HOSTS = [...AGGREGATOR_HOSTS, ...LOW_QUALITY_HOSTS];

function isExcludedSource(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return EXCLUDED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function urlKey(url: string): string {
  return url.trim().toLowerCase().replace(/[?#].*$/, '').replace(/\/$/, '');
}

/**
 * Fetches all Pulse sources and returns fresh stories bucketed by category.
 * Every story lands in at most one category, so the four categories always
 * work from disjoint source material.
 */
export async function fetchPulseStoriesByCategory(): Promise<Record<PulseSlug, RawStory[]>> {
  const [rss, newsApi, finnhub] = await Promise.all([
    fetchRssStories(PULSE_RSS_FEEDS, MAX_STORY_AGE_MS, '[pulse-ingest]'),
    fetchNewsApiStories(),
    fetchFinnhubStories(),
  ]);

  const cutoff = Date.now() - MAX_STORY_AGE_MS;
  const all: HintedStory[] = [...rss.map((story) => ({ story })), ...newsApi, ...finnhub];

  const buckets = Object.fromEntries(PULSE_SLUGS.map((slug) => [slug, []])) as unknown as Record<
    PulseSlug,
    RawStory[]
  >;
  const seenUrls = new Set<string>();

  for (const { story, hint } of all) {
    if (!story.title || !story.url) continue;
    if (isExcludedSource(story.url)) continue;
    if (Number.isNaN(story.publishedAt.getTime()) || story.publishedAt.getTime() < cutoff) continue;
    const key = urlKey(story.url);
    if (seenUrls.has(key)) continue;
    seenUrls.add(key);

    const slug = categorizeStory(story, hint);
    if (slug) buckets[slug].push(story);
  }

  return buckets;
}

const PRIORITY_ORDER: Record<StoryCluster['priority'], number> = { high: 1, low: 0 };

/**
 * Clusters a category's stories (same event across outlets) and ranks them:
 * multi-outlet corroboration first, then how squarely the story sits on the
 * category's beat (best member keyword score), then recency — so an on-beat
 * story beats a merely newer one that only grazed a keyword.
 */
export function rankPulseClusters(stories: RawStory[], slug: PulseSlug): StoryCluster[] {
  const relevance = new Map<StoryCluster, number>();
  const clusters = clusterAndWeight(stories);
  for (const c of clusters) {
    relevance.set(c, Math.max(...c.members.map((m) => scoreCategory(m, slug))));
  }
  return clusters.sort((a, b) => {
    const rank = PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority];
    if (rank !== 0) return rank;
    const rel = relevance.get(b)! - relevance.get(a)!;
    if (rel !== 0) return rel;
    return b.representative.publishedAt.getTime() - a.representative.publishedAt.getTime();
  });
}

export { urlKey as pulseSourceKey };

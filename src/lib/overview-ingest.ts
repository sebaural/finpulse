import Parser from 'rss-parser';

const parser = new Parser();

const NEWS_FEEDS = [
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
  'https://www.cnbc.com/id/100003114/device/rss/rss.html',
];

export interface RawStory {
  title: string;
  url: string;
  source: string;
  publishedAt: Date;
  snippet: string; // RSS teaser text only — never scraped full article body
}

export async function fetchWorldNewsFeeds(): Promise<RawStory[]> {
  const results = await Promise.allSettled(
    NEWS_FEEDS.map(async (feedUrl) => {
      const feed = await parser.parseURL(feedUrl);
      const sourceName = feed.title ?? new URL(feedUrl).hostname;

      return (feed.items ?? []).map((item): RawStory => ({
        title: item.title ?? '',
        url: item.link ?? '',
        source: sourceName,
        publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
        snippet: (item.contentSnippet ?? item.content ?? '').trim(),
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

import { dedupeStories } from './dedup'; // reuse existing clustering logic

export interface StoryCluster {
  representative: RawStory;
  members: RawStory[];
  sourceCount: number;
  priority: 'high' | 'low';
}

export function clusterAndWeight(stories: RawStory[]): StoryCluster[] {
  const clusters = dedupeStories(stories); // groups of RawStory[]

  return clusters.map((members): StoryCluster => {
    const distinctSources = new Set(members.map((m) => m.source));
    const sourceCount = distinctSources.size;

    // 2+ of the 3 feeds confirming a story = high priority
    const priority: StoryCluster['priority'] = sourceCount >= 2 ? 'high' : 'low';

    // Prefer BBC/NYT phrasing as the representative snippet over CNBC
    const representative =
      members.find((m) => m.source.includes('BBC') || m.source.includes('New York Times')) ??
      members[0];

    return { representative, members, sourceCount, priority };
  });
}

export function isGeopoliticsRelevant(story: RawStory): boolean {
  const keywords = [
    'sanctions', 'election', 'military', 'diplomacy', 'border',
    'ceasefire', 'treaty', 'summit', 'coup', 'invasion', 'nato',
    'united nations', 'security council',
  ];
  const text = `${story.title} ${story.snippet}`.toLowerCase();
  return keywords.some((k) => text.includes(k));
}


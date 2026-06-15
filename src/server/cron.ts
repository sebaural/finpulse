import { NextRequest, NextResponse } from 'next/server';
import { getMarketsSummaryArticles, runDailyMarketsPipeline } from '@/lib/markets-service';
import { getSummaryArticles as getGeopoliticsArticles, runDailyGeopoliticsPipeline } from '@/lib/geopolitics-service';
import { getTechSummaryArticles, runDailyTechPipeline } from '@/lib/tech-service';
import { hasPosted, markPosted } from '@/lib/dedup';
import { generateTweet } from '@/lib/claude';
import { postTweet } from '@/lib/twitter';
import { X_SECTIONS, type XBriefing, type XCronResult, type XPosterSection } from '@/types';

export function isCronAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get('authorization') ?? '';
  return authHeader === `Bearer ${cronSecret}`;
}

export async function runCronPipeline<T>(
  pipeline: () => Promise<T>,
): Promise<NextResponse<{ success: true; article: T } | { error: string; details?: string }>> {
  try {
    const article = await pipeline();
    return NextResponse.json({ success: true, article });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Pipeline failed', details }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// Unified daily content generation pipeline
// ---------------------------------------------------------------------------
//
// Runs all three summary-generation pipelines sequentially (one at a time) so a
// single cron job replaces the three previously-separate ones. Each section is
// fault-isolated: if one throws, the others still run and a partial result is
// returned. The three pipelines each return their own SummaryArticle shape, so
// the article type is a union of their return types.

type ContentSection = 'geopolitics' | 'markets' | 'tech';

type GeneratedArticle =
  | Awaited<ReturnType<typeof runDailyGeopoliticsPipeline>>
  | Awaited<ReturnType<typeof runDailyMarketsPipeline>>
  | Awaited<ReturnType<typeof runDailyTechPipeline>>;

export type ContentCronResult =
  | { section: ContentSection; success: true; article: GeneratedArticle }
  | { section: ContentSection; success: false; error: string };

export async function runDailyContentPipelines(): Promise<ContentCronResult[]> {
  const pipelines: { section: ContentSection; run: () => Promise<GeneratedArticle> }[] = [
    { section: 'geopolitics', run: runDailyGeopoliticsPipeline },
    { section: 'markets',     run: runDailyMarketsPipeline },
    { section: 'tech',        run: runDailyTechPipeline },
  ];

  const results: ContentCronResult[] = [];
  for (const { section, run } of pipelines) {
    try {
      const article = await run(); // sequential — one section at a time
      results.push({ section, success: true, article });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`[content-cron] [${section}] ${error}`);
      results.push({ section, success: false, error });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// X Auto-Poster pipeline
// ---------------------------------------------------------------------------

const SITE_URL = 'https://macrostance.com';

export async function getLatestBriefing(section: XPosterSection): Promise<XBriefing | null> {
  let articles: { title: string; slug: string; summary: string; keyPoints: string[]; date: string }[];

  if (section === 'markets') {
    articles = await getMarketsSummaryArticles(1);
  } else if (section === 'geopolitics') {
    articles = await getGeopoliticsArticles(1);
  } else {
    articles = await getTechSummaryArticles(1);
  }

  const article = articles[0];
  if (!article) return null;

  return {
    section,
    title:    article.title,
    url:      `${SITE_URL}/${section}/${article.slug}`,
    date:     article.date,
    bodyText: article.summary + '\n' + article.keyPoints.join('. '),
  };
}

export async function runXPosterPipeline(): Promise<XCronResult[]> {
  return Promise.all(
    X_SECTIONS.map(async ({ section }): Promise<XCronResult> => {
      const ts = new Date().toISOString();
      try {
        const briefing = await getLatestBriefing(section);
        if (!briefing) {
          return { section, success: false, error: 'No articles found' };
        }

        const alreadyPosted = await hasPosted(section, briefing.url);
        if (alreadyPosted) {
          return { section, success: true, skipped: true };
        }

        const tweetText = await generateTweet(briefing);
        const result = await postTweet(tweetText); // TEXT ONLY

        if (result.success) {
          await markPosted(section, briefing.url);
          return { section, success: true, tweetId: result.tweetId };
        }
        return { section, success: false, error: result.error };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error(`[x-poster] [${section}] ${ts} ${error}`);
        return { section, success: false, error };
      }
    }),
  );
}
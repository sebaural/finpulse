import { NextRequest } from 'next/server';
import { isCronAuthorized, getLatestBriefing } from '@/server/cron';
import { generateTweet } from '@/lib/claude';
import { postTweet } from '@/lib/twitter';
import { X_SECTIONS } from '@/types';

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  console.log('[cron/x-poster] Starting debug run...');

  try {
    const results = await Promise.all(
      X_SECTIONS.map(async ({ section }) => {
        try {
          const briefing = await getLatestBriefing(section);
          if (!briefing) {
            return { section, success: false, error: 'No articles found' };
          }

          const tweetText = await generateTweet(briefing);

          // === DEBUG LOG ===
          console.log(`[cron/x-poster] [${section}] Tweet text being sent:`);
          console.log(tweetText);
          console.log('---');

          const result = await postTweet(tweetText);

          return {
            section,
            success: result.success,
            tweetId: result.tweetId,
            error: result.error,
            tweetText,
          };
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          return { section, success: false, error };
        }
      })
    );

    return Response.json({ success: true, results });
  } catch (error) {
    console.error('[cron/x-poster] Error:', error);
    return Response.json({ success: false, error: 'Cron job failed' }, { status: 500 });
  }
}
import { TwitterApi } from 'twitter-api-v2';
import { getValidAccessToken } from './refreshToken';
import type { XPostResult } from '@/types';
import path from 'path';

const IMAGE_PATH = path.join(process.cwd(), 'public', 'macrostance_X.png');

export async function postTweet(text: string): Promise<XPostResult> {
  try {
    const accessToken = await getValidAccessToken();
    const userClient  = new TwitterApi(accessToken);
    const appClient   = new TwitterApi(process.env.X_BEARER_TOKEN!);

    const mediaId    = await appClient.v1.uploadMedia(IMAGE_PATH, { mimeType: 'image/png' });
    const { data }   = await userClient.v2.tweet({
      text,
      media: { media_ids: [mediaId] },
    });

    return { success: true, tweetId: data.id };
  } catch (err: unknown) {
    const ts = new Date().toISOString();
    const e  = err as { code?: number; status?: number; message?: string };
    const status = e.code ?? e.status;

    if (status === 403) {
      const msg = '403 Forbidden — duplicate tweet or missing write permissions';
      console.error(`[twitter] ${ts} ${msg}`);
      return { success: false, error: msg };
    }
    if (status === 429) {
      const msg = '429 Rate Limit exceeded — try again later';
      console.error(`[twitter] ${ts} ${msg}`);
      return { success: false, error: msg };
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error(`[twitter] ${ts} ${message}`);
    return { success: false, error: message };
  }
}

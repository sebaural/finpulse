import { TwitterApi } from 'twitter-api-v2';
import { getValidAccessToken } from './x-token';
import type { XPostResult } from '@/types';
import path from 'path';

const IMAGE_PATH = path.join(process.cwd(), 'public', 'macrostance_X.png');

export async function postTweet(text: string): Promise<XPostResult> {
  try {
    const accessToken = await getValidAccessToken();
    const client = new TwitterApi(accessToken);

    // Upload media
    const mediaId = await client.v1.uploadMedia(IMAGE_PATH, {
      mimeType: 'image/png',
    });

    // Post tweet with media
    const { data } = await client.v2.tweet({
      text,
      media: { media_ids: [mediaId] },
    });

    return { success: true, tweetId: data.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[twitter]', message);
    return { success: false, error: message };
  }
}
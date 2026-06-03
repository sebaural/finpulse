import { getValidAccessToken } from './x-token';
import type { XPostResult } from '@/types';
import path from 'path';
import fs from 'fs';

const IMAGE_PATH = path.join(process.cwd(), 'public', 'macrostance_X.png');

export async function postTweet(text: string): Promise<XPostResult> {
  try {
    const accessToken = await getValidAccessToken();

    // 1. Upload media
    const imageBuffer = fs.readFileSync(IMAGE_PATH);
    const mediaRes = await fetch('https://api.x.com/2/media/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: imageBuffer,
    });

    if (!mediaRes.ok) {
      const err = await mediaRes.text();
      return { success: false, error: `Media upload failed: ${mediaRes.status} ${err}` };
    }

    const mediaData = await mediaRes.json();
    const mediaId = mediaData.data.id;

    // 2. Post tweet with media
    const tweetRes = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        media: { media_ids: [mediaId] },
      }),
    });

    if (!tweetRes.ok) {
      const err = await tweetRes.text();
      console.error('[twitter]', tweetRes.status, err);
      return { success: false, error: `403 Forbidden — duplicate tweet or missing write permissions` };
    }

    const data = await tweetRes.json();
    return { success: true, tweetId: data.data.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[twitter]', message);
    return { success: false, error: message };
  }
}
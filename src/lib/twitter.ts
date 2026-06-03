import { getValidAccessToken } from './x-token';
import type { XPostResult } from '@/types';
import path from 'path';
import fs from 'fs';

const IMAGE_PATH = path.join(process.cwd(), 'public', 'macrostance_X.png');

export async function postTweet(text: string): Promise<XPostResult> {
  try {
    const accessToken = await getValidAccessToken();

    // Upload media
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
      const errText = await mediaRes.text();
      return { success: false, error: `Media upload failed: ${mediaRes.status} ${errText}` };
    }

    const mediaData = await mediaRes.json();
    const mediaId = mediaData.data.id;

    // Post tweet
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
      const errText = await tweetRes.text();
      return { success: false, error: `Tweet failed: ${tweetRes.status} ${errText}` };
    }

    const tweetData = await tweetRes.json();
    return { success: true, tweetId: tweetData.data.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[twitter]', message);
    return { success: false, error: message };
  }
}
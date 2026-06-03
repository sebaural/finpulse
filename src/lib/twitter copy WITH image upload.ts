import { getValidAccessToken } from './x-token';
import type { XPostResult } from '@/types';
import path from 'path';
import fs from 'fs';

const IMAGE_PATH = path.join(process.cwd(), 'public', 'macrostance_X.png');

async function uploadMediaChunked(accessToken: string, filePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const totalBytes = fileBuffer.length;

  // INIT
  const initRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      command: 'INIT',
      media_type: 'image/png',
      total_bytes: totalBytes,
      media_category: 'tweet_image',
    }),
  });

  if (!initRes.ok) {
    const err = await initRes.text();
    throw new Error(`INIT failed: ${initRes.status} ${err}`);
  }

  const initData = await initRes.json();
  const mediaId = initData.data.id;

  // APPEND
  const appendRes = await fetch(
    `https://upload.twitter.com/1.1/media/upload.json?command=APPEND&media_id=${mediaId}&segment_index=0`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/octet-stream',
      },
      body: fileBuffer,
    }
  );

  if (!appendRes.ok) {
    const err = await appendRes.text();
    throw new Error(`APPEND failed: ${appendRes.status} ${err}`);
  }

  // FINALIZE
  const finalizeRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      command: 'FINALIZE',
      media_id: mediaId,
    }),
  });

  if (!finalizeRes.ok) {
    const err = await finalizeRes.text();
    throw new Error(`FINALIZE failed: ${finalizeRes.status} ${err}`);
  }

  return mediaId;
}

export async function postTweet(text: string): Promise<XPostResult> {
  try {
    const accessToken = await getValidAccessToken();
    const mediaId = await uploadMediaChunked(accessToken, IMAGE_PATH);

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
      return { success: false, error: `Tweet failed: ${tweetRes.status} ${err}` };
    }

    const data = await tweetRes.json();
    return { success: true, tweetId: data.data.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[twitter]', message);
    return { success: false, error: message };
  }
}
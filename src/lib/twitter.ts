import { getValidAccessToken } from './x-token';
import type { XPostResult } from '@/types';
import path from 'path';
import fs from 'fs';

const IMAGE_PATH = path.join(process.cwd(), 'public', 'macrostance_X.png');

async function uploadMediaChunked(accessToken: string, filePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const totalBytes = fileBuffer.length;
  const mediaType = 'image/png';

  // INIT
  const initRes = await fetch('https://api.x.com/2/media/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      command: 'INIT',
      media_type: mediaType,
      total_bytes: totalBytes,
    }),
  });

  if (!initRes.ok) throw new Error(`INIT failed: ${initRes.status}`);
  const { data: initData } = await initRes.json();
  const mediaId = initData.id;

  // APPEND (single chunk for small image)
  const appendRes = await fetch('https://api.x.com/2/media/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
    },
    body: fileBuffer,
  });

  if (!appendRes.ok) throw new Error(`APPEND failed: ${appendRes.status}`);

  // FINALIZE
  const finalizeRes = await fetch('https://api.x.com/2/media/upload', {
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

  if (!finalizeRes.ok) throw new Error(`FINALIZE failed: ${finalizeRes.status}`);

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
import { getValidAccessToken } from './x-token';
import type { XPostResult } from '@/types';

async function uploadMedia(accessToken: string, imageBuffer: Buffer): Promise<string> {
  const res = await fetch('https://api.x.com/2/media/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
async function uploadMedia(accessToken: string, image: Buffer): Promise<string> {
  const res = await fetch('https://api.x.com/2/media/upload', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      media: {
        media: imageBuffer.toString('base64'),
        media: image.toString('base64'),
        media_type: 'image/png',
      },
    }),
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`X media upload failed: ${res.status} ${error}`);
    throw new Error(`X media upload error: ${res.status} ${error}`);
  }

  const data = await res.json();
  return data.data.id;
}

export async function postTweet(text: string, imageBuffer?: Buffer): Promise<XPostResult> {
  try {
    const accessToken = await getValidAccessToken();
    const mediaId = imageBuffer ? await uploadMedia(accessToken, imageBuffer) : null;
export async function postTweet(text: string, image?: Buffer): Promise<XPostResult> {
  try {
    const accessToken = await getValidAccessToken();
    const mediaId = image ? await uploadMedia(accessToken, image) : undefined;

    const res = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        mediaId ? { text, media: { media_ids: [mediaId] } } : { text },
      ),
      body: JSON.stringify(mediaId ? { text, media: { media_ids: [mediaId] } } : { text }),
    });

    if (!res.ok) {
      const error = await res.text();
      console.error('[twitter]', res.status, error);
      return { success: false, error: `X API error: ${res.status}` };
    }

    const data = await res.json();
    return { success: true, tweetId: data.data.id };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[twitter]', message);
    return { success: false, error: message };
  }
}

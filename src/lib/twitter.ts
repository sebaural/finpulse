import { getValidAccessToken } from './x-token';
import type { XPostResult } from '@/types';

export async function postTweet(
  text: string,
  mediaBuffer?: Buffer,
  mediaType = 'image/png'
): Promise<XPostResult> {
  try {
    const accessToken = await getValidAccessToken();

    if (accessToken) {
  console.log('[twitter] Access token retrieved successfully. First 30 chars:', accessToken.substring(0, 30));
} else {
  console.error('[twitter] Failed to retrieve access token');
  return { success: false, error: 'No access token' };
}

    let mediaIds: string[] = [];

    if (mediaBuffer) {
      const mediaPayload = {
        media: {
          media: mediaBuffer.toString('base64'),
          media_type: mediaType,
        },
      };

      console.log('[media upload] Request payload:', JSON.stringify(mediaPayload, null, 2));

      const uploadRes = await fetch('https://api.x.com/2/media/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mediaPayload),
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        console.error('[media upload] FULL ERROR:', uploadRes.status, errorText);
        return { success: false, error: 'Media upload failed' };
      }

      const uploadData = await uploadRes.json();
      mediaIds = [uploadData.data.id];
    }

    const tweetBody: any = { text };
    if (mediaIds.length > 0) {
      tweetBody.media = { media_ids: mediaIds };
    }

    const res = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tweetBody),
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
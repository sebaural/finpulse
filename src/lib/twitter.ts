import { getValidAccessToken } from './x-token';
import type { XPostResult } from '@/types';

export async function postTweet(text: string): Promise<XPostResult> {
  try {
    const accessToken = await getValidAccessToken();

    const res = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
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
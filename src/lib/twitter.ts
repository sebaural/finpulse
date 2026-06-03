import type { XPostResult } from '@/types';
import { getValidAccessToken } from './x-token';

export async function postTweet(text: string) {
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
}
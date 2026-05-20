import { SITE_URL } from '@/lib/seo';

/**
 * Notify Bing of new or updated URLs via IndexNow.
 * Server-side only — never call from client components.
 *
 * @param urls - Absolute URLs on macrostance.com to submit
 */
export async function notifyBing(urls: string[]): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[IndexNow] Skipping in non-production env:', urls);
    return;
  }

  try {
    const res = await fetch(`${SITE_URL}/api/indexnow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('[IndexNow] Submission failed:', err);
    } else {
      console.log('[IndexNow] Submitted', urls.length, 'URL(s)');
    }
  } catch (err) {
    console.error('[IndexNow] Network error:', err);
  }
}

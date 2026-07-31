import { SITE_URL } from '@/lib/seo';

const INDEXNOW_KEY = process.env.INDEXNOW_KEY;
const HOST = new URL(SITE_URL).hostname;

// Submits already-validated, SITE_URL-scoped URLs to Bing's IndexNow API.
// Shared by the /api/indexnow route handler and notifyBing() below so
// neither has to round-trip through macrostance.com to reach the other —
// that domain is Cloudflare-proxied and challenges non-browser requests,
// which silently broke notifyBing()'s self-fetch to /api/indexnow.
export async function submitToIndexNow(urls: string[]): Promise<void> {
  if (!INDEXNOW_KEY) {
    throw new Error('INDEXNOW_KEY environment variable is not set');
  }

  const response = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`IndexNow submission failed (${response.status}): ${detail}`);
  }
}

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
    await submitToIndexNow(urls);
    console.log('[IndexNow] Submitted', urls.length, 'URL(s)');
  } catch (err) {
    console.error('[IndexNow] Submission failed:', err);
  }
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Next.js 16 renamed `middleware` → `proxy` (middleware.ts is deprecated).
// The exported function must be named `proxy` (or be the default export).
export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const path = url.pathname;

  // Matches legacy vertical article URLs: /geopolitics/slug, /markets/slug, /tech/slug
  const legacyMatch = path.match(/^\/(geopolitics|markets|tech)\/([a-zA-Z0-9_-]+)$/);

  if (legacyMatch) {
    const slug = legacyMatch[2];

    try {
      const res = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/rpc/get_article_topic_mapping`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: process.env.SUPABASE_ANON_KEY!,
          },
          body: JSON.stringify({ article_slug: slug }),
          cache: 'no-store',
        },
      );

      // Non-ok response (4xx/5xx) — fall through and serve the legacy route.
      if (!res.ok) {
        console.error(`Edge redirect: Supabase returned ${res.status} for slug "${slug}"`);
        return NextResponse.next();
      }

      // get_article_topic_mapping uses RETURNS TABLE → Supabase serialises this
      // as an array, not a plain object. data.topic_slug would always be
      // undefined — use data[0]?.topic_slug.
      const data: { topic_slug: string }[] = await res.json();
      const topicSlug = data[0]?.topic_slug;

      if (topicSlug) {
        url.pathname = `/topics/${topicSlug}/${slug}`;
        return NextResponse.redirect(url, 301);
      }
    } catch (error) {
      // Network failure or JSON parse error — fall through, never hard-fail a redirect.
      console.error(`Edge redirect mapping failure for slug "${slug}":`, error);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/geopolitics/:slug*', '/markets/:slug*', '/tech/:slug*'],
};

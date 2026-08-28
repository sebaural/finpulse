import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/seo';

export const revalidate = 86400;

export async function GET() {
  const body =
`User-Agent: *
Content-Signal: search=yes, ai-input=yes, ai-train=no
Allow: /
Disallow: /api/

User-Agent: MJ12bot
Disallow: /

Host: ${SITE_URL}
Sitemap: https://macrostance.com/sitemap.xml
Sitemap: https://macrostance.com/sitemap-dynamic.xml
Sitemap: https://macrostance.com/sitemap-news.xml
`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
    },
  });
}

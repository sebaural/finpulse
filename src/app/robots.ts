import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/api/'] },
      { userAgent: 'bingbot', allow: '/' },
      { userAgent: 'AhrefsBot',  crawlDelay: 10 },
      { userAgent: 'SemrushBot', crawlDelay: 10 },
      { userAgent: 'MJ12bot',    disallow: '/' },
    ],
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/sitemap-dynamic.xml`,
      `${SITE_URL}/sitemap-news.xml`,
    ],
    host: SITE_URL,
  };
}

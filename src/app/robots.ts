import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { 
        userAgent: '*', 
        allow: '/', 
        disallow: ['/api/'] 
      },
      { 
        userAgent: 'MJ12bot', 
        disallow: '/' 
      },
    ],
    sitemap: [
      'https://macrostance.com/sitemap.xml',
      'https://macrostance.com/sitemap-dynamic.xml',
      'https://macrostance.com/sitemap-news.xml',
    ],
    host: SITE_URL,
  };
}

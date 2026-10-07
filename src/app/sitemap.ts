import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export const revalidate = 3600;

// Static pages only. Article URLs (legacy verticals, /topics/, /pulse/) are
// submitted solely via sitemap-dynamic.xml so no URL is listed twice.
// /geopolitics, /markets and /tech are omitted: they 307-redirect to the
// latest article, and listing redirects shows up as "Page with redirect" in GSC.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${SITE_URL}/`,                    lastModified: now, changeFrequency: 'hourly',  priority: 1.0 },
    { url: `${SITE_URL}/deep-dive-analysis`,  lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE_URL}/macro-landscape`,     lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE_URL}/overview`,            lastModified: now, changeFrequency: 'daily',   priority: 0.9 },
    { url: `${SITE_URL}/about`,               lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/editorial-standards`, lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/data-sources`,        lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/contact`,             lastModified: now, changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${SITE_URL}/disclaimer`,          lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${SITE_URL}/privacy`,             lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
    { url: `${SITE_URL}/terms`,               lastModified: now, changeFrequency: 'yearly',  priority: 0.4 },
  ];
}

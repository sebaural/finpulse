// src/app/geopolitics/page.tsx

import type { Metadata } from 'next';
import { getSummaryArticles } from '@/lib/geopolitics-service';
import GeopoliticsPageClient from '@/components/geopolitics/GeopoliticsPageClient';
import {
  buildMetadata,
  jsonLd,
  breadcrumbSchema,
  personSchema,
  canonicalUrl,
  SITE_NAME,
  SITE_URL,
  SITE_LOGO,
} from '@/lib/seo';
import '@/components/geopolitics/geopolitics.css';

export const metadata: Metadata = buildMetadata({
  title: 'Geopolitics of the Day — Daily Intelligence Briefings',
  description:
    'Daily geopolitical intelligence briefings synthesizing the top global developments — from conflict and diplomacy to energy markets and trade policy.',
  path: '/geopolitics',
  ogTitle:
    'MacroStance Geopolitics — Daily Briefings on Global Risk and Markets',
  ogDescription:
    'Concise daily synthesis of the most consequential geopolitical events shaping global markets, energy, and policy. Updated every 24 hours.',
});

export const revalidate = 3600;

const EDITORIAL_AUTHOR = personSchema({
  name: 'MacroStance Editorial Desk',
  url: `${SITE_URL}/about`,
  jobTitle: 'Editorial Desk',
  description:
    'The MacroStance Editorial Desk produces daily geopolitical intelligence briefings, synthesizing reporting from wire services, regional financial media, and primary government sources. Briefings are AI-assisted and reviewed by the editorial team before publication.',
  image: SITE_LOGO,
  sameAs: [`${SITE_URL}/about`, `${SITE_URL}/editorial-standards`],
});

export default async function GeopoliticsPage() {
  const articles = await getSummaryArticles(30);
  const lead = articles[0];

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'Geopolitics', url: canonicalUrl('/geopolitics') },
  ]);

  const articleSchema = lead
    ? {
        '@context': 'https://schema.org',
        '@type': 'NewsArticle',
        headline: lead.title,
        description: lead.summary?.slice(0, 280),
        datePublished: lead.createdAt.toISOString(),
        dateModified: lead.createdAt.toISOString(),
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonicalUrl('/geopolitics'),
        },
        author: {
          '@type': 'Person',
          name: 'MacroStance Editorial Desk',
          url: `${SITE_URL}/about`,
        },
        publisher: {
          '@type': 'NewsMediaOrganization',
          name: SITE_NAME,
          url: SITE_URL,
          logo: {
            '@type': 'ImageObject',
            url: SITE_LOGO,
          },
        },
        keywords: lead.tags?.join(', '),
        articleSection: 'Geopolitics',
      }
    : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(EDITORIAL_AUTHOR) }}
      />
      {articleSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(articleSchema) }}
        />
      )}
      <GeopoliticsPageClient articles={articles} />
    </>
  );
}

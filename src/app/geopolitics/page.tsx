// src/app/geopolitics/page.tsx

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSummaryArticles } from '@/lib/geopolitics-service';
import {
  buildMetadata,
  jsonLd,
  breadcrumbSchema,
  canonicalUrl,
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

export default async function GeopoliticsPage() {
  const articles = await getSummaryArticles(30);
  const lead = articles[0];

  if (lead) {
    redirect(`/geopolitics/${lead.slug}`);
  }

  // No articles yet — render a minimal empty-state page.
  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'Geopolitics', url: canonicalUrl('/geopolitics') },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <div className="geo-root">
        <div className="geo-empty">
          <span className="geo-empty-globe">🌐</span>
          <h2 className="geo-empty-heading">No summaries yet</h2>
          <p className="geo-empty-text">
            Daily geopolitical briefings will appear here once the pipeline has run.
          </p>
        </div>
      </div>
    </>
  );
}

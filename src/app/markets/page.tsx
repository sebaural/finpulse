// src/app/markets/page.tsx

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getMarketsSummaryArticles } from '@/lib/markets-service';
import {
  buildMetadata,
  jsonLd,
  breadcrumbSchema,
  canonicalUrl,
} from '@/lib/seo';
import '@/components/geopolitics/geopolitics.css';

export const metadata: Metadata = buildMetadata({
  title: 'Markets of the Day — Daily Intelligence Briefings',
  description:
    'Daily markets intelligence briefings synthesizing top developments across equities, fixed income, FX, commodities, and central-bank policy.',
  path: '/markets',
  ogTitle:
    'MacroStance Markets — Daily Briefings on Global Capital Markets',
  ogDescription:
    'Concise daily synthesis of the most consequential market events shaping equities, rates, FX, and commodities. Updated every 24 hours.',
});

export const revalidate = 3600;

export default async function MarketsPage() {
  const articles = await getMarketsSummaryArticles(30);
  const lead = articles[0];

  if (lead) {
    redirect(`/markets/${lead.slug}`);
  }

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'Markets', url: canonicalUrl('/markets') },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <div className="geo-root">
        <div className="geo-empty">
          <span className="geo-empty-globe">📈</span>
          <h2 className="geo-empty-heading">No summaries yet</h2>
          <p className="geo-empty-text">
            Daily markets briefings will appear here once the pipeline has run.
          </p>
        </div>
      </div>
    </>
  );
}

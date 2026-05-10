// src/app/tech/page.tsx

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getTechSummaryArticles } from '@/lib/tech-service';
import {
  buildMetadata,
  jsonLd,
  breadcrumbSchema,
  canonicalUrl,
} from '@/lib/seo';
import '@/components/geopolitics/geopolitics.css';

export const metadata: Metadata = buildMetadata({
  title: 'Tech of the Day — Daily Intelligence Briefings',
  description:
    'Daily technology intelligence briefings synthesizing top developments across AI, semiconductors, cloud, cybersecurity, and platform shifts.',
  path: '/tech',
  ogTitle:
    'MacroStance Tech — Daily Briefings on Technology and Innovation',
  ogDescription:
    'Concise daily synthesis of the most consequential tech events shaping AI, semis, cloud, and software. Updated every 24 hours.',
});

export const revalidate = 3600;

export default async function TechPage() {
  const articles = await getTechSummaryArticles(30);
  const lead = articles[0];

  if (lead) {
    redirect(`/tech/${lead.slug}`);
  }

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'Tech', url: canonicalUrl('/tech') },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <div className="geo-root">
        <div className="geo-empty">
          <span className="geo-empty-globe">💻</span>
          <h2 className="geo-empty-heading">No summaries yet</h2>
          <p className="geo-empty-text">
            Daily tech briefings will appear here once the pipeline has run.
          </p>
        </div>
      </div>
    </>
  );
}

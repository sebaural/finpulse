// src/app/overview/page.tsx

import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getPrisma } from '@/lib/db';
import {
  buildMetadata,
  jsonLd,
  breadcrumbSchema,
  canonicalUrl,
  formatDateSegment,
} from '@/lib/seo';
import '@/components/geopolitics/geopolitics.css';
import NavMenu from '@/components/topNav/NavMenu';
import Image from 'next/image';

export const metadata: Metadata = buildMetadata({
  title: 'Daily Overview — Global Geopolitics Briefings',
  description:
    'A daily geopolitics overview synthesizing the day’s top global developments from multiple news sources.',
  path: '/overview',
  ogTitle: 'MacroStance Overview — Daily Global Geopolitics Briefing',
  ogDescription:
    'A concise daily synthesis of the most consequential geopolitical stories, cross-checked across multiple news sources. Updated weekdays.',
});

export const revalidate = 3600;

export default async function OverviewPage() {
  const prisma = getPrisma();
  const articles = await prisma.overviewArticle.findMany({
    orderBy: { publishedDate: 'desc' },
    take: 30,
  });
  const lead = articles[0];

  if (lead) {
    redirect(`/overview/${formatDateSegment(lead.publishedDate)}/${lead.slug}`);
  }

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'Overview', url: canonicalUrl('/overview') },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />

      <header>
        <div className="header-inner">
          <div className="logo">
            <Image src="/macrostance-logo.png" alt="MacroStance mark" className="logo-mark" width={40} height={40} priority />
            <h1>MacroStance</h1>
          </div>
          <NavMenu />
        </div>
      </header>

      <div className="geo-root">
        <div className="geo-empty">
          <span className="geo-empty-globe">🌍</span>
          <h2 className="geo-empty-heading">No overview articles yet</h2>
          <p className="geo-empty-text">
            Daily geopolitics overviews will appear here once the pipeline has run.
          </p>
        </div>
      </div>
    </>
  );
}

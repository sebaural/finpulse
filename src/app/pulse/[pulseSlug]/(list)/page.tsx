import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { PulsePageClient } from '@/components/pulse/PulsePageClient';
import { PULSE_CATEGORIES, PULSE_SLUGS, resolvePulseSlug } from '@/lib/pulse-categories';
import { getPulseArticles, pulseArticleTime } from '@/lib/pulse-service';
import { breadcrumbSchema, buildMetadata, canonicalUrl, jsonLd } from '@/lib/seo';
import type { PulseSlug } from '@/types/pulse';

export const dynamic = 'force-dynamic';

const PULSE_PAGE_SIZE = 18;

interface PulsePageProps {
  params: Promise<{ pulseSlug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

// Shared by generateMetadata and the page, so the list is queried once.
const loadSortedArticles = cache(async (pulseSlug: PulseSlug) => {
  const articles = await getPulseArticles(pulseSlug);
  return [...articles].sort((a, b) => pulseArticleTime(b) - pulseArticleTime(a));
});

// Out-of-range or malformed ?page values fall back to the nearest real page
// (no notFound: this route has a loading.tsx, so it would soft-404).
function resolvePage(raw: string | string[] | undefined, total: number): {
  page: number;
  pageCount: number;
} {
  const pageCount = Math.max(1, Math.ceil(total / PULSE_PAGE_SIZE));
  const n = Number.parseInt(Array.isArray(raw) ? raw[0] : (raw ?? '1'), 10);
  const page = Number.isFinite(n) ? Math.min(Math.max(n, 1), pageCount) : 1;
  return { page, pageCount };
}

function pagePath(pulseSlug: string, page: number): string {
  return page > 1 ? `/pulse/${pulseSlug}?page=${page}` : `/pulse/${pulseSlug}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: PulsePageProps): Promise<Metadata> {
  const { pulseSlug: rawPulseSlug } = await params;
  const pulseSlug = resolvePulseSlug(rawPulseSlug);
  if (!pulseSlug) {
    return {};
  }

  const config = PULSE_CATEGORIES[pulseSlug];
  const articles = await loadSortedArticles(pulseSlug);
  const { page } = resolvePage((await searchParams).page, articles.length);
  const pageSuffix = page > 1 ? ` — Page ${page}` : '';

  const metadata = buildMetadata({
    title: `${config.label} Pulse — Daily Intelligence Feed${pageSuffix}`,
    description: `MacroStance ${config.label.toLowerCase()} pulse with continuously refreshed intelligence briefs generated from global event signals.`,
    path: `/pulse/${pulseSlug}`,
    ogTitle: `${config.label} Pulse | MacroStance`,
    ogDescription: `Track the latest ${config.label.toLowerCase()} pulse developments and related intelligence briefings.`,
  });
  if (page === 1) return metadata;

  // canonicalUrl() drops query strings; each archive page is its own canonical.
  const url = `${canonicalUrl(`/pulse/${pulseSlug}`)}?page=${page}`;
  return {
    ...metadata,
    alternates: { canonical: url },
    openGraph: { ...metadata.openGraph, url },
  };
}

export default async function PulsePage({ params, searchParams }: PulsePageProps) {
  const { pulseSlug: rawPulseSlug } = await params;
  const pulseSlug = resolvePulseSlug(rawPulseSlug);
  if (!pulseSlug) notFound();

  const config = PULSE_CATEGORIES[pulseSlug];
  const allArticles = await loadSortedArticles(pulseSlug);
  const { page, pageCount } = resolvePage((await searchParams).page, allArticles.length);
  const articles = allArticles.slice((page - 1) * PULSE_PAGE_SIZE, page * PULSE_PAGE_SIZE);

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: `${config.label} Pulse`, url: canonicalUrl(`/pulse/${pulseSlug}`) },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <PulsePageClient
        config={config}
        articles={articles}
        totalCount={allArticles.length}
        newerHref={page > 1 ? pagePath(pulseSlug, page - 1) : null}
        olderHref={page < pageCount ? pagePath(pulseSlug, page + 1) : null}
        page={page}
        pageCount={pageCount}
      />
    </>
  );
}

export function generateStaticParams() {
  return PULSE_SLUGS.map((pulseSlug) => ({ pulseSlug }));
}

// src/app/overview/page.tsx

import type { Metadata } from 'next';
import Link from 'next/link';
import { getPrisma } from '@/lib/db';
import { buildMetadata, jsonLd, breadcrumbSchema, canonicalUrl } from '@/lib/seo';
import type { OverviewCategorySlug } from '@/lib/overview-categories';
import type { OverviewDayView } from '@/types/overview';
import SiteHeader from '@/components/SiteHeader';
import OverviewFeed from '@/components/overview/OverviewFeed';
import './overview.css';

export const metadata: Metadata = buildMetadata({
  title: 'Daily Overview — Global Geopolitics Briefings',
  description:
    'A daily geopolitics briefing covering U.S., East Asia, Middle East, Europe, and Africa developments from multiple news sources.',
  path: '/overview',
  ogTitle: 'MacroStance Overview — Daily Global Geopolitics Briefing',
  ogDescription:
    'A concise daily briefing across five global regions, cross-checked across multiple news sources. Updated weekdays.',
});

export const revalidate = 3600;

// Paginated by calendar day, this many day-sections per page.
const DAYS_PER_PAGE = 10;

function formatDayHeading(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function OverviewPage({ searchParams }: Props) {
  const { page: pageParam } = await searchParams;

  const prisma = getPrisma();
  const requestedPage = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);

  const totalDays = await prisma.overviewDay.count();
  const totalPages = Math.max(1, Math.ceil(totalDays / DAYS_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);

  const days = await prisma.overviewDay.findMany({
    orderBy: { publishedDate: 'desc' },
    skip: (currentPage - 1) * DAYS_PER_PAGE,
    take: DAYS_PER_PAGE,
    include: { blocks: { orderBy: { category: 'asc' } } },
  });

  const now = new Date();
  const dayViews: OverviewDayView[] = days.map((day) => ({
    id: day.id,
    dateLabel: formatDayHeading(day.publishedDate),
    isToday: isSameUtcDay(day.publishedDate, now),
    context: day.context,
    blocks: day.blocks.map((block) => ({
      id: block.id,
      category: block.category as OverviewCategorySlug,
      title: block.title,
      description: block.description,
      summary: block.summary,
    })),
  }));

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'Overview', url: canonicalUrl('/overview') },
  ]);

  const hasPrev = currentPage > 1;
  const hasNext = currentPage < totalPages;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />

      <SiteHeader />

      <div className="overview-root">
        {dayViews.length === 0 ? (
          <div className="overview-empty">
            <span className="overview-empty-globe">🌍</span>
            <h2 className="overview-empty-heading">No overview briefings yet</h2>
            <p className="overview-empty-text">
              Daily regional briefings will appear here once the pipeline has run.
            </p>
          </div>
        ) : (
          <main className="overview-main">
            <div className="overview-page-header">
              <h1 className="overview-headline">Daily Global Geopolitics Briefing</h1>
              <p className="overview-subtitle">
                The day&rsquo;s most consequential developments across five regions, synthesized
                from multiple sources. Updated weekdays.
              </p>
            </div>

            <OverviewFeed days={dayViews} />

            {totalPages > 1 && (
              <nav className="overview-pager" aria-label="Overview pagination">
                {hasPrev ? (
                  <Link href={`/overview?page=${currentPage - 1}`} className="overview-pager-link">
                    ← Previous
                  </Link>
                ) : (
                  <span className="overview-pager-disabled">← Previous</span>
                )}
                <span className="overview-pager-status">
                  Page {currentPage} of {totalPages}
                </span>
                {hasNext ? (
                  <Link href={`/overview?page=${currentPage + 1}`} className="overview-pager-link">
                    Next →
                  </Link>
                ) : (
                  <span className="overview-pager-disabled">Next →</span>
                )}
              </nav>
            )}
          </main>
        )}
      </div>
    </>
  );
}

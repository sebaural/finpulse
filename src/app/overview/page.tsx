// src/app/overview/page.tsx

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import type { OverviewArticleModel } from '@/generated/prisma/client/models/OverviewArticle';
import { getPrisma } from '@/lib/db';
import {
  buildMetadata,
  jsonLd,
  breadcrumbSchema,
  canonicalUrl,
  formatDateSegment,
} from '@/lib/seo';
import './overview.css';
import NavMenu from '@/components/topNav/NavMenu';

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

// The whole list is paginated by calendar day, this many days per page.
const DAY_GROUPS_PER_PAGE = 10;

// Bounds the query well past what several pages of days need (the pipeline
// publishes roughly ~8 articles/day), without scanning the entire table as
// OverviewArticle keeps growing.
const MAX_ARTICLES_FETCHED = 1000;

interface DayGroup {
  dateSegment: string;
  date: Date;
  articles: OverviewArticleModel[];
}

function formatGroupHeading(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// publishedDate carries a time component, so grouping is done in JS keyed by
// the same MM-DD-YYYY segment the article's own URL uses (formatDateSegment)
// — that keeps a day's heading and its articles' links pointed at the same
// calendar day. Articles arrive pre-sorted desc by publishedDate, so day
// groups come out newest-first too.
function groupByDay(articles: OverviewArticleModel[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const bySegment = new Map<string, DayGroup>();

  for (const article of articles) {
    const dateSegment = formatDateSegment(article.publishedDate);
    let group = bySegment.get(dateSegment);
    if (!group) {
      group = { dateSegment, date: article.publishedDate, articles: [] };
      bySegment.set(dateSegment, group);
      groups.push(group);
    }
    group.articles.push(article);
  }

  return groups;
}

function ArticleRow({
  article,
  dateSegment,
}: {
  article: OverviewArticleModel;
  dateSegment: string;
}) {
  return (
    <Link
      href={`/overview/${dateSegment}/${article.slug}`}
      className="overview-article-row"
    >
      <div className="overview-article-row-title">{article.title}</div>
      <p className="overview-article-row-summary">{article.summary}</p>
    </Link>
  );
}

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function OverviewPage({ searchParams }: Props) {
  const { page: pageParam } = await searchParams;

  const prisma = getPrisma();
  const articles = await prisma.overviewArticle.findMany({
    orderBy: { publishedDate: 'desc' },
    take: MAX_ARTICLES_FETCHED,
  });

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

      <div className="overview-root">
        {articles.length === 0 ? (
          <div className="overview-empty">
            <span className="overview-empty-globe">🌍</span>
            <h2 className="overview-empty-heading">No overview articles yet</h2>
            <p className="overview-empty-text">
              Daily geopolitics overviews will appear here once the pipeline has run.
            </p>
          </div>
        ) : (
          <main className="overview-main">
            <h1 className="overview-headline">Daily Overview</h1>
            <hr className="overview-rule" />

            {(() => {
              const dayGroups = groupByDay(articles);

              const totalPages = Math.max(1, Math.ceil(dayGroups.length / DAY_GROUPS_PER_PAGE));
              const requestedPage = Math.max(1, parseInt(pageParam ?? '1', 10) || 1);
              const currentPage = Math.min(requestedPage, totalPages);
              const pageStart = (currentPage - 1) * DAY_GROUPS_PER_PAGE;
              const pageGroups = dayGroups.slice(pageStart, pageStart + DAY_GROUPS_PER_PAGE);

              const hasPrev = currentPage > 1;
              const hasNext = currentPage < totalPages;

              return (
                <>
                  <div className="overviews-container">
                    {pageGroups.map((group) => (
                      <section key={group.dateSegment} className="overview-day-group">
                        <h2 className="overview-day-heading">{formatGroupHeading(group.date)}</h2>
                        <div className="overview-article-list">
                          {group.articles.map((article) => (
                            <ArticleRow
                              key={article.id}
                              article={article}
                              dateSegment={group.dateSegment}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>

                  {totalPages > 1 && (
                    <nav className="overview-pager" aria-label="Overview pagination">
                      {hasPrev ? (
                        <Link
                          href={`/overview?page=${currentPage - 1}`}
                          className="overview-pager-link"
                        >
                          ← Previous
                        </Link>
                      ) : (
                        <span className="overview-pager-disabled">← Previous</span>
                      )}
                      <span className="overview-pager-status">
                        Page {currentPage} of {totalPages}
                      </span>
                      {hasNext ? (
                        <Link
                          href={`/overview?page=${currentPage + 1}`}
                          className="overview-pager-link"
                        >
                          Next →
                        </Link>
                      ) : (
                        <span className="overview-pager-disabled">Next →</span>
                      )}
                    </nav>
                  )}
                </>
              );
            })()}
          </main>
        )}
      </div>
    </>
  );
}

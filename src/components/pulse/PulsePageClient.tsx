'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import PulseHeader from '@/components/pulse/PulseHeader';
import { formatPulseDisplayDate, getPulseDisplayDateSource } from '@/lib/pulse-date';
import type { PulseArticle, PulseCategoryConfig } from '@/types/pulse';
import './pulse.css';

// `articles` is one server-sorted page (newest first); paging uses real
// ?page=N links so crawlers can reach every article, not a client "load more".
interface PulsePageClientProps {
  config: PulseCategoryConfig;
  articles: PulseArticle[];
  totalCount: number;
  newerHref: string | null;
  olderHref: string | null;
  page: number;
  pageCount: number;
}

function formatMetaDate(article: PulseArticle): string {
  return formatPulseDisplayDate(getPulseDisplayDateSource(article)) ?? 'No timestamp';
}

export function PulsePageClient({
  config,
  articles,
  totalCount,
  newerHref,
  olderHref,
  page,
  pageCount,
}: PulsePageClientProps) {
  const title = useMemo(() => `${config.label} Pulse`, [config.label]);

  return (
    <>
      <PulseHeader />
      <main className="pulse-page">
        <div className="pulse-container">
          <div className="pulse-head">
            <p className="pulse-kicker">News Pulse</p>
            <h1>{title}</h1>
            <p className="pulse-subtitle">
              Global events, distilled into real-time briefings.
            </p>
          </div>

          {totalCount === 0 ? (
            <p className="pulse-empty">No updates yet for this category.</p>
          ) : (
            <>
              <ul className="pulse-article-list">
                {articles.map((article) => (
                  <li key={article.articleSlug} className="pulse-article-item">
                    <Link
                      className="pulse-article-link"
                      href={`/pulse/${config.pulseSlug}/${article.articleSlug}`}
                    >
                      <span className="pulse-article-meta">{formatMetaDate(article)}</span>
                      <span className="pulse-article-title">{article.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>

              {pageCount > 1 ? (
                <nav className="pulse-pagination" aria-label={`${title} pages`}>
                  {newerHref ? (
                    <Link href={newerHref} className="pulse-load-more-btn" rel="prev">
                      ← Newer
                    </Link>
                  ) : (
                    <span />
                  )}
                  <span className="pulse-pagination-status">
                    Page {page} of {pageCount}
                  </span>
                  {olderHref ? (
                    <Link href={olderHref} className="pulse-load-more-btn" rel="next">
                      Older →
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              ) : null}
            </>
          )}
        </div>
      </main>
    </>
  );
}

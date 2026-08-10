'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import PulseHeader from '@/components/pulse/PulseHeader';
import { formatPulseDisplayDate, getPulseDisplayDateSource } from '@/lib/pulse-date';
import type { PulseArticle, PulseCategoryConfig } from '@/types/pulse';
import './pulse.css';

const PAGE_SIZE = 18;

interface PulsePageClientProps {
  config: PulseCategoryConfig;
  articles: PulseArticle[];
}

// Same key the row's meta line displays (`observedStart ?? publishedAt`), so the
// sort order always matches the visible date. Missing/invalid dates sort last.
function articleTimestamp(article: PulseArticle): number {
  const value = article.observedStart ?? article.publishedAt;
  if (!value) return -Infinity;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? -Infinity : t;
}

function formatMetaDate(article: PulseArticle): string {
  return formatPulseDisplayDate(getPulseDisplayDateSource(article)) ?? 'No timestamp';
}

export function PulsePageClient({ config, articles }: PulsePageClientProps) {
  const title = useMemo(() => `${config.label} Pulse`, [config.label]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Latest date first (descending), regardless of the order the server sends.
  const sortedArticles = useMemo(
    () => [...articles].sort((a, b) => articleTimestamp(b) - articleTimestamp(a)),
    [articles],
  );

  const visibleArticles = useMemo(
    () => sortedArticles.slice(0, visibleCount),
    [sortedArticles, visibleCount],
  );
  const remaining = sortedArticles.length - visibleArticles.length;

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

          {articles.length === 0 ? (
            <p className="pulse-empty">No updates yet for this category.</p>
          ) : (
            <>
              <ul className="pulse-article-list">
                {visibleArticles.map((article) => (
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

              {remaining > 0 ? (
                <div className="pulse-load-more">
                  <button
                    type="button"
                    className="pulse-load-more-btn"
                    onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                  >
                    Load more ({remaining} more)
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>
    </>
  );
}

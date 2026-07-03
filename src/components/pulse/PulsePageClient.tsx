'use client';

import { useMemo, useState } from 'react';
import PulseHeader from '@/components/pulse/PulseHeader';
import { PulseArticleModal } from '@/components/pulse/PulseArticleModal';
import type { PulseArticle, PulseCategoryConfig } from '@/types/pulse';
import './pulse.css';

interface PulsePageClientProps {
  config: PulseCategoryConfig;
  articles: PulseArticle[];
}

function formatTime(value?: string | null): string {
  if (!value) return 'No timestamp';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'No timestamp';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

export function PulsePageClient({ config, articles }: PulsePageClientProps) {
  const title = useMemo(() => `${config.label} Pulse`, [config.label]);
  const [selectedArticle, setSelectedArticle] = useState<PulseArticle | null>(null);

  return (
    <>
      <PulseHeader />
      <main className="pulse-page">
        <div className="pulse-container">
          <div className="pulse-head">
            <p className="pulse-kicker">News Pulse</p>
            <h1>{title}</h1>
            <p className="pulse-subtitle">
              Real-time signal digest generated from global event summaries and normalized into
              editorial briefings.
            </p>
          </div>

          {articles.length === 0 ? (
            <p className="pulse-empty">No updates yet for this category.</p>
          ) : (
            <ul className="pulse-article-list">
              {articles.map((article) => (
                <li
                  key={article.articleSlug}
                  className="pulse-article-item"
                  onClick={() => setSelectedArticle(article)}
                >
                  <div
                    className="pulse-article-link"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedArticle(article);
                      }
                    }}
                  >
                    <span className="pulse-article-title">{article.title}</span>
                    <span className="pulse-article-meta">{formatTime(article.observedStart ?? article.publishedAt)}</span>
                    {article.summary ? <span className="pulse-article-summary">{article.summary}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {selectedArticle ? (
            <PulseArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
          ) : null}
        </div>
      </main>
    </>
  );
}

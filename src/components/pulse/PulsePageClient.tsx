'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import PulseHeader from '@/components/pulse/PulseHeader';
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
                <li key={article.articleSlug} className="pulse-article-item">
                  <Link
                    className="pulse-article-link"
                    href={`/pulse/${config.pulseSlug}/${article.articleSlug}`}
                  >
                    <span className="pulse-article-title">{article.title}</span>
                    <span className="pulse-article-meta">{formatTime(article.observedStart ?? article.publishedAt)}</span>
                    {article.summary ? <span className="pulse-article-summary">{article.summary}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </>
  );
}

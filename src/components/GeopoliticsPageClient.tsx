// src/components/GeopoliticsPageClient.tsx
'use client';

import { useState } from 'react';
import type { SummaryArticle } from '@/types/geopolitics';
import NavMenu from '@/components/NavMenu';
import './geopolitics.css';

interface Props {
  articles: SummaryArticle[];
}

function formatShortDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatFullDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function GeopoliticsPageClient({ articles }: Props) {
  const [selected, setSelected] = useState<SummaryArticle | null>(articles[0] ?? null);

  return (
    <div className="geo-root">
        {/* ── Top nav bar ── */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '6px 24px', borderBottom: '1px solid #1e2530', background: '#111418' }}>
          <NavMenu variant="dark" />
        </div>

        {/* ── Page Header ── */}
        <header className="geo-header">
          <h1 className="geo-masthead">
            Geopolitics <em>of the Day</em>
          </h1>
          <div className="geo-statusbar">
            <span className="geo-statusbar-item">
              <strong>Updated</strong> daily at 08:00 UTC
            </span>
            <span className="geo-statusbar-item">
              <strong>{articles.length}</strong> briefings archived
            </span>
          </div>
        </header>

        {/* ── Body Layout ── */}
        <div className="geo-layout">
          {/* Sidebar */}
          <aside className="geo-sidebar">
            <div className="geo-sidebar-header">Archive</div>
            {articles.map((a) => (
              <div
                key={a.id}
                className={`geo-sidebar-item${selected?.id === a.id ? ' active' : ''}`}
                onClick={() => setSelected(a)}
              >
                <div className="geo-sidebar-date">{formatShortDate(a.date)}</div>
                <div className="geo-sidebar-title">{a.title}</div>
                <div className="geo-sidebar-region">{a.region}</div>
              </div>
            ))}
          </aside>

          {/* Main */}
          <main className="geo-main">
            {!selected ? (
              <div className="geo-empty">
                <span className="geo-empty-globe">🌐</span>
                <h2 className="geo-empty-heading">No summaries yet</h2>
                <p className="geo-empty-text">
                  Daily geopolitical briefings will appear here once the pipeline has run. Trigger
                  the cron job or call the generate endpoint to create the first briefing.
                </p>
              </div>
            ) : (
              <article>
                <div className="geo-article-meta">
                  <span className="geo-region-badge">{selected.region}</span>
                  <span className="geo-article-date">{formatFullDate(selected.date)}</span>
                </div>

                <h2 className="geo-headline">{selected.title}</h2>
                <hr className="geo-rule" />

                <div className="geo-body">
                  {selected.summary.split('\n\n').map((para, i) => (
                    <p key={i}>{para}</p>
                  ))}
                </div>

                <section className="geo-takeaways">
                  <p className="geo-takeaways-title">Key Takeaways</p>
                  {selected.keyPoints.map((point, i) => (
                    <div key={i} className="geo-takeaway-item">
                      <span className="geo-takeaway-arrow" aria-hidden="true">▸</span>
                      <span>{point}</span>
                    </div>
                  ))}
                </section>

                <div className="geo-tags">
                  {selected.tags.map((tag) => (
                    <span key={tag} className="geo-tag">{tag}</span>
                  ))}
                </div>

                <section>
                  <p className="geo-sources-title">Source Articles</p>
                  <div className="geo-sources-grid">
                    {selected.sourceArticles.map((src, i) => (
                      <div key={i} className="geo-source-card">
                        <p className="geo-source-name">{src.source}</p>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="geo-source-link"
                        >
                          {src.title}
                        </a>
                      </div>
                    ))}
                  </div>
                </section>
              </article>
            )}
          </main>
        </div>
      </div>
  );
}

// src/components/GeopoliticsPageClient.tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');

    const syncViewportState = (matches: boolean) => {
      setIsMobileViewport(matches);

      if (!matches) {
        setIsMobileSidebarOpen(false);
      }
    };

    syncViewportState(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      syncViewportState(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  const handleSidebarToggle = () => {
    if (!isMobileViewport) {
      return;
    }

    setIsMobileSidebarOpen((current) => !current);
  };

  const handleArticleSelect = (article: SummaryArticle) => {
    setSelected(article);

    if (isMobileViewport) {
      setIsMobileSidebarOpen(false);
    }
  };

  return (
    <div className="geo-root">
        {/* ── Top nav bar ── */}
        <div className="geo-top-nav" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 24px', borderBottom: '1px solid #1e2530', background: '#111418' }}>
          <Link href="/" className="logo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Image src="/macrostance-logo.png" alt="MacroStance mark" className="logo-mark" width={40} height={40} priority />
            <span>MacroStance</span>
          </Link>
          <NavMenu variant="dark" />
        </div>

        {/* ── Page Header ── */}
        <header className="geo-header">
          <h1 className="geo-masthead">
            Geopolitics <em>of the Day</em>
          </h1>
          <div className="geo-statusbar">
            <span className="geo-statusbar-item">
              <strong>Updated</strong> daily at 15:00 UTC
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
            <button
              type="button"
              className={`geo-sidebar-header${isMobileSidebarOpen ? ' is-open' : ''}`}
              onClick={handleSidebarToggle}
              aria-expanded={isMobileViewport ? isMobileSidebarOpen : true}
              aria-controls="geo-sidebar-items"
            >
              <span>Archive</span>
              <span className="geo-sidebar-arrow" aria-hidden="true">▾</span>
            </button>
            <div
              id="geo-sidebar-items"
              className={`geo-sidebar-items${isMobileSidebarOpen ? ' is-open' : ''}`}
            >
              <div className="geo-sidebar-items-inner">
                {articles.map((a) => (
                  <div
                    key={a.id}
                    className={`geo-sidebar-item${selected?.id === a.id ? ' active' : ''}`}
                    onClick={() => handleArticleSelect(a)}
                  >
                    <div className="geo-sidebar-date">{formatShortDate(a.date)}</div>
                    <h3 className="geo-sidebar-title">{a.title}</h3>
                    <div className="geo-sidebar-region">{a.region}</div>
                  </div>
                ))}
              </div>
            </div>
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

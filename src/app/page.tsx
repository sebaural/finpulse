'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { loadNewsArticles, marketRows, tickerItems } from '../lib/news';
import { useSpeechReader } from '../hooks/useSpeechReader';
import type { NewsArticle } from '../types';

type FilterKey =
  | 'all'
  | 'markets'
  | 'economy'
  | 'equities'
  | 'forex'
  | 'commodities'
  | 'crypto'
  | 'geopolitics'
  | 'tech'
  | 'energy';

const filterTabs: Array<{ key: FilterKey; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'markets', label: 'Markets' },
  { key: 'economy', label: 'Economy' },
  { key: 'equities', label: 'Equities' },
  { key: 'forex', label: 'Forex' },
  { key: 'commodities', label: 'Commodities' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'geopolitics', label: 'Geopolitics' },
  { key: 'tech', label: 'Tech' },
  { key: 'energy', label: 'Energy' },
];

function subscribeToHydration() {
  return () => {};
}

export default function Page() {
  const [allArticles, setAllArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFallbackBanner, setShowFallbackBanner] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const hasHydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  const filteredArticles = useMemo(() => {
    if (filter === 'all') return allArticles;
    return allArticles.filter((a) => a.category.toLowerCase() === filter);
  }, [allArticles, filter]);

  const selectableVoices = useMemo(
    () => voices.filter((voice) => voice.lang.startsWith('en') || voice.lang === 'ru'),
    [voices],
  );

  const speech = useSpeechReader(filteredArticles);

  const hero = allArticles[0] ?? null;

  async function refresh() {
    setLoading(true);
    const result = await loadNewsArticles();
    setAllArticles(result.articles);
    setShowFallbackBanner(result.usingFallback);
    setLoading(false);
  }

  useEffect(() => {
    const kickoff = window.setTimeout(() => {
      void refresh();
    }, 0);
    const id = window.setInterval(() => {
      void refresh();
    }, 5 * 60 * 1000);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated || !('speechSynthesis' in window)) return;

    const loadVoices = () => {
      setVoices(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
    };
  }, [hasHydrated]);

  return (
    <>
      <div className="ticker-wrap" aria-label="Market ticker">
        <div className="ticker-inner">
          {tickerItems.concat(tickerItems).map((item, idx) => (
            <span className="ticker-item" key={`${item.symbol}-${idx}`}>
              <span className="sym">{item.symbol}</span> {item.value}{' '}
              <span className={item.direction}>{item.direction === 'pos' ? `+${item.change.replace('+', '')}` : item.change}</span>
            </span>
          ))}
        </div>
      </div>

      <header>
        <div className="logo">
          <Image src="/logo.png" alt="FinPulse mark" className="logo-mark" width={22} height={22} priority />
          <span>FinPulse</span>
        </div>
        <nav>
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              className={`nav-btn ${filter === tab.key ? 'active' : ''}`}
              onClick={() => setFilter(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <div className="page">
        <div className="layout">
          <div>
            {hero && (
              <section className="hero-card">
                <div className="hero-label">Breaking</div>
                <div className="hero-title">{hero.title}</div>
                <div className="hero-summary">{hero.summary}</div>
                <div className="hero-footer">
                  <span className={`source-tag ${hero.cls}`}>{hero.source}</span>
                  <span className="card-time">{hero.time}</span>
                  <button className="read-btn" onClick={() => speech.readById(hero.id)}>
                    Read Aloud
                  </button>
                  <a href={hero.link} className="card-link" target="_blank" rel="noreferrer">
                    Read full story {'->'}
                  </a>
                </div>
              </section>
            )}

            <div className="data-status-row" aria-live="polite">
              {showFallbackBanner ? (
                <>
                  <span className="data-status-badge fallback">Demo data mode</span>
                  <button className="inline-retry subtle" onClick={refresh}>
                    Retry live sources
                  </button>
                </>
              ) : (
                <span className="data-status-badge live">Live market feed</span>
              )}
            </div>

            <div className="news-feed">
              {loading && [1, 2, 3].map((n) => <div key={n} className="loading-card skeleton-block" />)}

              {!loading && filteredArticles.length === 0 && (
                <div className="empty-state">No stories match this filter.</div>
              )}

              {!loading &&
                filteredArticles.map((article) => {
                  const reading = speech.currentArticleId === article.id;
                  return (
                    <article
                      className={`news-card ${article.cls} ${reading ? 'is-reading' : ''}`}
                      key={article.id}
                      onClick={() => speech.readById(article.id)}
                    >
                      <div className="card-meta">
                        <span className={`source-tag ${article.cls}`}>{article.source}</span>
                        <span className="card-time">{article.time}</span>
                        <span className="card-category">{article.category}</span>
                      </div>
                      <h2 className="card-title">{article.title}</h2>
                      <p className="card-summary">{article.summary}</p>
                      <div className="card-actions">
                        <button
                          className={`read-btn ${reading ? 'active' : ''}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            speech.readById(article.id);
                          }}
                        >
                          Read Aloud
                        </button>
                        <a
                          href={article.link}
                          className="card-link"
                          target="_blank"
                          rel="noreferrer"
                          onClick={(event) => event.stopPropagation()}
                        >
                          Full story {'->'}
                        </a>
                      </div>
                    </article>
                  );
                })}
            </div>
          </div>

          <aside className="sidebar">
            <div className="voice-player">
              <div className="player-label">
                AI Voice Reader
                <div className={`wave-container ${speech.isPlaying ? 'speaking' : ''}`} aria-hidden="true">
                  <div className="wave-bar" />
                  <div className="wave-bar" />
                  <div className="wave-bar" />
                  <div className="wave-bar" />
                  <div className="wave-bar" />
                </div>
              </div>

              <div className="player-now-reading">
                {filteredArticles.find((a) => a.id === speech.currentArticleId)?.title ?? 'Select a story to read aloud'}
              </div>

              {speech.hasResolvedSupport && !speech.isSupported && (
                <div className="unsupported">
                  Text-to-speech is not supported in this browser. Use a modern Chromium-based browser.
                </div>
              )}

              <div className="player-controls">
                <button className="ctrl-btn" onClick={speech.prev} title="Previous">
                  Prev
                </button>
                <button className="ctrl-btn play-main" onClick={speech.togglePlayPause} title="Play/Pause">
                  {speech.isPlaying ? 'Pause' : 'Play'}
                </button>
                <button className="ctrl-btn" onClick={speech.next} title="Next">
                  Next
                </button>
                <button className="ctrl-btn" onClick={speech.stopReading} title="Stop">
                  Stop
                </button>
                <select
                  className="speed-select"
                  value={speech.speechRate}
                  onChange={(e) => speech.setSpeechRate(Number(e.target.value))}
                >
                  <option value={0.8}>0.8x</option>
                  <option value={1}>1x</option>
                  <option value={1.2}>1.2x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>
                <select
                  className="speed-select voice-select"
                  value={hasHydrated ? speech.voice?.voiceURI ?? '' : ''}
                  onChange={(event) => {
                    const selected = selectableVoices.find((voice) => voice.voiceURI === event.target.value) ?? null;
                    speech.setVoice(selected);
                  }}
                  disabled={!hasHydrated || !speech.isSupported || selectableVoices.length === 0}
                  title="Voice"
                >
                  {!hasHydrated ? (
                    <option value="">Loading voices...</option>
                  ) : selectableVoices.length === 0 ? (
                    <option value="">No English/Russian voices</option>
                  ) : (
                    selectableVoices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))
                  )}
                </select>
                <button
                  className={`ctrl-btn ${speech.autoplay ? 'active' : ''}`}
                  onClick={speech.toggleAutoplay}
                  title="Auto-play all"
                >
                  Auto
                </button>
              </div>

              <div className="progress-bar" aria-label="Playback progress">
                <div className="progress-fill" style={{ width: `${speech.progressPct}%` }} />
              </div>
            </div>

            <section className="widget">
              <div className="widget-title">Market Snapshot</div>
              {marketRows.map((row) => (
                <div className="market-row" key={row.name}>
                  <span className="market-name">{row.name}</span>
                  <span className="market-val">{row.value}</span>
                  <span className={`market-chg ${row.direction}`}>{row.change}</span>
                </div>
              ))}
            </section>

            <section className="widget">
              <div className="widget-title">Most Read</div>
              {allArticles.slice(0, 6).map((article) => (
                <div className="side-story" key={article.id} onClick={() => speech.readById(article.id)}>
                  <div className="side-story-source" style={{ color: `var(--${article.cls})` }}>
                    {article.source}
                  </div>
                  <div className="side-story-title">{article.title}</div>
                  <div className="side-story-time">{article.time}</div>
                </div>
              ))}
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

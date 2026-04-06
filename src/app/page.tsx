'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { loadNewsArticles, tickerItems as staticTickerItems, marketRows as staticMarketRows } from '../lib/news';
import { useSpeechReader } from '../hooks/useSpeechReader';
import type { FeedParser, FeedSource, MarketRow, NewsArticle, TickerItem } from '../types';

interface MarketResponse {
  tickerItems: TickerItem[];
  marketRows: MarketRow[];
  cachedAt: string;
  live: boolean;
}

interface FeedSourcesResponse {
  sources: FeedSource[];
}

interface FeedFormState {
  name: string;
  type: 'rss' | 'api';
  url: string;
  category: string;
  parser: FeedParser;
  apiKeyEnv: string;
  refreshIntervalSec: number;
  priority: 1 | 2 | 3;
  enabled: boolean;
}

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

const initialFeedFormState: FeedFormState = {
  name: '',
  type: 'rss',
  url: '',
  category: 'Markets',
  parser: 'custom',
  apiKeyEnv: '',
  refreshIntervalSec: 60,
  priority: 2,
  enabled: true,
};

function feedSignature(items: FeedSource[]): string {
  return JSON.stringify(
    [...items]
      .map((s) => ({
        id: s.id,
        name: s.name,
        type: s.type,
        url: s.url,
        enabled: s.enabled,
        category: s.category,
        parser: s.parser,
        apiKeyEnv: s.apiKeyEnv ?? '',
        refreshIntervalSec: s.refreshIntervalSec,
        priority: s.priority,
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  );
}

function subscribeToHydration() {
  return () => {};
}

function clientRelativeTime(publishedAt: string | undefined, fallback: string): string {
  if (!publishedAt) return fallback;
  const diff = (Date.now() - new Date(publishedAt).getTime()) / 1000;
  if (diff < 0 || Number.isNaN(diff)) return fallback;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function Page() {
  const [allArticles, setAllArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFallbackBanner, setShowFallbackBanner] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [, setTick] = useState(0);
  const [tickerItems, setTickerItems] = useState<TickerItem[]>(staticTickerItems);
  const [marketRows, setMarketRows] = useState<MarketRow[]>(staticMarketRows);
  const [marketLive, setMarketLive] = useState(false);
  const [feedSources, setFeedSources] = useState<FeedSource[]>([]);
  const [draftFeedSources, setDraftFeedSources] = useState<FeedSource[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedSaving, setFeedSaving] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [editingFeedId, setEditingFeedId] = useState<string | null>(null);
  const [feedForm, setFeedForm] = useState<FeedFormState>(initialFeedFormState);
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
  const hasPendingFeedChanges = useMemo(
    () => feedSignature(feedSources) !== feedSignature(draftFeedSources),
    [feedSources, draftFeedSources],
  );

  const hero = allArticles[0] ?? null;

  async function refresh() {
    setLoading(true);
    const result = await loadNewsArticles();
    setAllArticles(result.articles);
    setShowFallbackBanner(result.usingFallback);
    setLoading(false);
  }

  async function refreshMarket() {
    try {
      const res = await fetch('/api/market', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as MarketResponse;
      setTickerItems(data.tickerItems);
      setMarketRows(data.marketRows);
      setMarketLive(data.live);
    } catch {
      // Keep showing last state on error.
    }
  }

  async function loadFeedSources() {
    setFeedLoading(true);
    setFeedError(null);

    try {
      const res = await fetch('/api/feeds', { cache: 'no-store' });
      if (!res.ok) {
        setFeedError('Unable to load feed sources');
        return;
      }

      const data = (await res.json()) as FeedSourcesResponse;
      const nextSources = Array.isArray(data.sources) ? data.sources : [];
      setFeedSources(nextSources);
      setDraftFeedSources(nextSources);
    } catch {
      setFeedError('Unable to load feed sources');
    } finally {
      setFeedLoading(false);
    }
  }

  function resetFeedForm() {
    setEditingFeedId(null);
    setFeedForm(initialFeedFormState);
  }

  function startEditFeed(source: FeedSource) {
    setEditingFeedId(source.id);
    setFeedForm({
      name: source.name,
      type: source.type,
      url: source.url,
      category: source.category,
      parser: source.parser,
      apiKeyEnv: source.apiKeyEnv ?? '',
      refreshIntervalSec: source.refreshIntervalSec,
      priority: source.priority,
      enabled: source.enabled,
    });
  }

  async function saveFeedSource() {
    setFeedError(null);

    if (!feedForm.name.trim() || !feedForm.url.trim()) {
      setFeedError('Name and URL are required before adding/editing a source');
      return;
    }

    const payload: FeedSource = {
      id: editingFeedId ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: feedForm.name.trim(),
      type: feedForm.type,
      url: feedForm.url.trim(),
      enabled: feedForm.enabled,
      category: feedForm.category.trim(),
      parser: feedForm.parser,
      apiKeyEnv: feedForm.apiKeyEnv.trim() || undefined,
      refreshIntervalSec: feedForm.refreshIntervalSec,
      priority: feedForm.priority,
    };

    setDraftFeedSources((prev) => {
      const idx = prev.findIndex((s) => s.id === payload.id);
      if (idx < 0) return [...prev, payload];
      const next = [...prev];
      next[idx] = payload;
      return next;
    });

    resetFeedForm();
  }

  async function toggleFeedEnabled(source: FeedSource) {
    setDraftFeedSources((prev) =>
      prev.map((s) => (s.id === source.id ? { ...s, enabled: !s.enabled } : s)),
    );
  }

  async function deleteFeedSource(id: string) {
    setDraftFeedSources((prev) => prev.filter((s) => s.id !== id));
    if (editingFeedId === id) {
      resetFeedForm();
    }
  }

  async function applyFeedChanges() {
    setFeedSaving(true);
    setFeedError(null);

    try {
      const baseMap = new Map(feedSources.map((s) => [s.id, s]));
      const draftMap = new Map(draftFeedSources.map((s) => [s.id, s]));

      // Delete removed existing sources
      for (const source of feedSources) {
        if (!draftMap.has(source.id)) {
          await fetch(`/api/feeds/${source.id}`, { method: 'DELETE' });
        }
      }

      // Create or patch changed sources
      for (const source of draftFeedSources) {
        const isDraft = source.id.startsWith('draft-');

        if (isDraft) {
          await fetch('/api/feeds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: source.name,
              type: source.type,
              url: source.url,
              enabled: source.enabled,
              category: source.category,
              parser: source.parser,
              apiKeyEnv: source.apiKeyEnv,
              refreshIntervalSec: source.refreshIntervalSec,
              priority: source.priority,
            }),
          });
          continue;
        }

        const base = baseMap.get(source.id);
        if (!base) continue;
        if (feedSignature([base]) === feedSignature([source])) continue;

        await fetch(`/api/feeds/${source.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: source.name,
            type: source.type,
            url: source.url,
            enabled: source.enabled,
            category: source.category,
            parser: source.parser,
            apiKeyEnv: source.apiKeyEnv,
            refreshIntervalSec: source.refreshIntervalSec,
            priority: source.priority,
          }),
        });
      }

      await loadFeedSources();
      await refresh();
    } catch {
      setFeedError('Failed to apply feed changes');
    } finally {
      setFeedSaving(false);
    }
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
    void refreshMarket();
    const id = window.setInterval(() => { void refreshMarket(); }, 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void loadFeedSources();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    try {
      const raw = window.localStorage.getItem('finpulse:saved-article-ids');
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        setSavedIds(parsed.filter((id): id is string => typeof id === 'string'));
      }
    } catch {
      // Ignore malformed localStorage data.
    }
  }, [hasHydrated]);

  const toggleSaved = (articleId: string) => {
    setSavedIds((prev) => {
      const next = prev.includes(articleId)
        ? prev.filter((id) => id !== articleId)
        : [...prev, articleId];

      try {
        window.localStorage.setItem('finpulse:saved-article-ids', JSON.stringify(next));
      } catch {
        // Ignore quota/storage errors.
      }

      return next;
    });
  };

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
                  const saved = savedIds.includes(article.id);
                  const priorityCls =
                    article.importance === 1
                      ? 'breaking'
                      : article.importance === 2
                        ? 'important'
                        : 'regular';
                  const priorityTitle =
                    article.importance === 1
                      ? 'Breaking'
                      : article.importance === 2
                        ? 'Important'
                        : 'Regular';
                  return (
                    <article
                      className={`news-card ${article.cls} ${reading ? 'is-reading' : ''}`}
                      key={article.id}
                      onClick={() => speech.readById(article.id)}
                    >
                      <div className="card-meta">
                        <span className={`priority-dot ${priorityCls}`} title={priorityTitle} />
                        <span className={`source-tag ${article.cls}`}>{article.source}</span>
                        <span className="card-category-badge">{article.category}</span>
                        {article.impact && (
                          <span className={`impact-badge ${article.impact.toLowerCase()}`}>
                            {article.impact}
                          </span>
                        )}
                        <span className="card-time">
                          {clientRelativeTime(article.publishedAt, article.time)}
                        </span>
                      </div>
                      <h2 className="card-title">{article.title}</h2>
                      <p className="card-summary">{article.summary}</p>
                      <div className="card-hover-preview" role="tooltip" aria-hidden="true">
                        {article.summary}
                      </div>
                      <div className="card-actions">
                        <a
                          href={article.link}
                          className="action-btn"
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Open
                        </a>
                        <button
                          className={`action-btn play-btn ${reading ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            speech.readById(article.id);
                          }}
                        >
                          ▶ Play
                        </button>
                        <button
                          className="action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            void navigator.clipboard.writeText(`${article.title}\n${article.link}`);
                          }}
                        >
                          Copy
                        </button>
                        <button
                          className={`action-btn save-btn ${saved ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSaved(article.id);
                          }}
                        >
                          {saved ? 'Saved' : 'Save'}
                        </button>
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
                  suppressHydrationWarning
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
              <div className="widget-title">
                Market Snapshot
                {marketLive && <span className="market-live-dot" title="Live data" />}
              </div>
              {marketRows.map((row) => (
                <div className="market-row" key={row.name}>
                  <span className="market-name">{row.name}</span>
                  <span className="market-val">{row.value}</span>
                  <span className={`market-chg ${row.direction}`}>{row.change}</span>
                </div>
              ))}
            </section>

            <section className="widget">
              <div className="widget-title">Admin Feed Settings</div>

              {feedError && <div className="feed-error">{feedError}</div>}

              <div className="feed-form-grid">
                <input
                  className="feed-input"
                  placeholder="Source name"
                  value={feedForm.name}
                  onChange={(e) => setFeedForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <select
                  className="feed-input"
                  value={feedForm.type}
                  onChange={(e) =>
                    setFeedForm((prev) => ({
                      ...prev,
                      type: e.target.value as 'rss' | 'api',
                      parser: e.target.value === 'rss' ? 'custom' : 'json',
                    }))
                  }
                >
                  <option value="rss">RSS</option>
                  <option value="api">API</option>
                </select>
                <input
                  className="feed-input feed-input-full"
                  placeholder="https://..."
                  value={feedForm.url}
                  onChange={(e) => setFeedForm((prev) => ({ ...prev, url: e.target.value }))}
                />
                <input
                  className="feed-input"
                  placeholder="Category"
                  value={feedForm.category}
                  onChange={(e) => setFeedForm((prev) => ({ ...prev, category: e.target.value }))}
                />
                <select
                  className="feed-input"
                  value={feedForm.parser}
                  onChange={(e) =>
                    setFeedForm((prev) => ({ ...prev, parser: e.target.value as FeedParser }))
                  }
                >
                  <option value="custom">custom</option>
                  <option value="json">json</option>
                  <option value="rss2json">rss2json</option>
                </select>
                <input
                  className="feed-input"
                  placeholder="API key env (optional)"
                  value={feedForm.apiKeyEnv}
                  onChange={(e) => setFeedForm((prev) => ({ ...prev, apiKeyEnv: e.target.value }))}
                />
                <input
                  className="feed-input"
                  type="number"
                  min={15}
                  value={feedForm.refreshIntervalSec}
                  onChange={(e) =>
                    setFeedForm((prev) => ({ ...prev, refreshIntervalSec: Number(e.target.value) || 60 }))
                  }
                />
                <select
                  className="feed-input"
                  value={feedForm.priority}
                  onChange={(e) =>
                    setFeedForm((prev) => ({ ...prev, priority: Number(e.target.value) as 1 | 2 | 3 }))
                  }
                >
                  <option value={1}>1 Breaking</option>
                  <option value={2}>2 Important</option>
                  <option value={3}>3 Regular</option>
                </select>
              </div>

              <div className="feed-actions">
                <button className="action-btn" onClick={saveFeedSource} disabled={feedSaving}>
                  {editingFeedId ? 'Queue update' : 'Queue add'}
                </button>
                <button
                  className="action-btn play-btn"
                  onClick={() => void applyFeedChanges()}
                  disabled={feedSaving || !hasPendingFeedChanges}
                >
                  {feedSaving ? 'Applying...' : 'Apply'}
                </button>
                {editingFeedId && (
                  <button className="action-btn" onClick={resetFeedForm}>
                    Cancel edit
                  </button>
                )}
              </div>

              {hasPendingFeedChanges && (
                <div className="side-story-time">You have unapplied feed changes.</div>
              )}

              <div className="feed-list">
                {feedLoading && <div className="side-story-time">Loading sources...</div>}
                {!feedLoading &&
                  draftFeedSources.map((source) => (
                    <div className="feed-row" key={source.id}>
                      <label className="feed-toggle-wrap">
                        <input
                          type="checkbox"
                          checked={source.enabled}
                          onChange={() => {
                            void toggleFeedEnabled(source);
                          }}
                        />
                        <span>{source.enabled ? 'On' : 'Off'}</span>
                      </label>
                      <div className="feed-row-main">
                        <div className="feed-row-name">{source.name}</div>
                        <div className="feed-row-meta">
                          {source.type.toUpperCase()} • {source.category} • {source.refreshIntervalSec}s
                        </div>
                      </div>
                      <button className="action-btn" onClick={() => startEditFeed(source)}>
                        Edit
                      </button>
                      <button className="action-btn" onClick={() => void deleteFeedSource(source.id)}>
                        Delete
                      </button>
                    </div>
                  ))}
              </div>
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

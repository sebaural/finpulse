'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { loadNewsArticles, tickerItems as staticTickerItems, marketRows as staticMarketRows } from '../services/news';
import { useSpeechReader } from '../hooks/useSpeechReader';
import type { FeedParser, FeedSource, MarketRow, NewsArticle, TickerItem } from '../types';

import { MarketTicker } from '@/components/market/MarketTicker';
import { MarketSnapshot } from '@/components/market/MarketSnapshot';
import { NewsCard } from '@/components/news/NewsCard';
import { HeroCard } from '@/components/news/HeroCard';
import { SidebarNewsItem } from '@/components/news/SidebarNewsItem';
import { VoicePlayer } from '@/components/ui/VoicePlayer';
import { AdminFeedSettings } from '@/components/ui/AdminFeedSettings';

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

  async function applyFeedChanges() {
    setFeedSaving(true);
    setFeedError(null);

    try {
      const baseMap = new Map(feedSources.map((s) => [s.id, s]));

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
      <MarketTicker items={tickerItems} />

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
              <HeroCard article={hero} onRead={speech.readById} />
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
                filteredArticles.map((article) => (
                  <NewsCard
                    key={article.id}
                    article={article}
                    isReading={speech.currentArticleId === article.id}
                    isSaved={savedIds.includes(article.id)}
                    onRead={speech.readById}
                    onToggleSave={toggleSaved}
                    relativeTime={clientRelativeTime(article.publishedAt, article.time)}
                  />
                ))}
            </div>
          </div>

          <aside className="sidebar">
            <VoicePlayer
              speech={speech}
              filteredArticles={filteredArticles}
              selectableVoices={selectableVoices}
              hasHydrated={hasHydrated}
            />

            <MarketSnapshot rows={marketRows} isLive={marketLive} />

            <AdminFeedSettings
              feedError={feedError}
              feedForm={feedForm}
              setFeedForm={setFeedForm}
              saveFeedSource={saveFeedSource}
              feedSaving={feedSaving}
              editingFeedId={editingFeedId}
              resetFeedForm={resetFeedForm}
              hasPendingFeedChanges={hasPendingFeedChanges}
              feedLoading={feedLoading}
              draftFeedSources={draftFeedSources}
              toggleFeedEnabled={toggleFeedEnabled}
              startEditFeed={startEditFeed}
              applyFeedChanges={applyFeedChanges}
            />

            <section className="widget">
              <div className="widget-title">Most Read</div>
              {allArticles.slice(0, 6).map((article) => (
                <SidebarNewsItem
                  key={article.id}
                  article={article}
                  onRead={speech.readById}
                />
              ))}
            </section>
          </aside>
        </div>
      </div>
    </>
  );
}

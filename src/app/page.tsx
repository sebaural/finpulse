'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { loadNewsArticles, tickerItems as staticTickerItems, marketRows as staticMarketRows } from '../services/news';
import { useSpeechReader } from '../hooks/useSpeechReader';
import type { FeedSource, MarketRow, NewsArticle, TickerItem } from '../types';

import { MarketTicker } from '@/components/market/MarketTicker';
import { MarketSnapshot } from '@/components/market/MarketSnapshot';
import { NewsCard } from '@/components/news/NewsCard';
import { HeroCard } from '@/components/news/HeroCard';
import { SidebarNewsItem } from '@/components/news/SidebarNewsItem';
import { HeaderFilters } from '@/components/ui/HeaderFilters';
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

type CategoryFilterKey =
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

type PriorityFilterKey = 'all' | 'breaking' | 'important' | 'regular';

const categoryFilterOptions: Array<{ key: CategoryFilterKey; label: string }> = [
  { key: 'all', label: 'All Categories' },
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

const priorityFilterOptions: Array<{ key: PriorityFilterKey; label: string }> = [
  { key: 'all', label: 'All Priorities' },
  { key: 'breaking', label: 'Breaking' },
  { key: 'important', label: 'Important' },
  { key: 'regular', label: 'Regular' },
];

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
        apiKeyEnv: s.apiKeyEnv ?? '',
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

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = (await response.text()).trim();
    if (!body) return fallback;

    try {
      const parsed = JSON.parse(body) as { error?: unknown };
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return parsed.error.trim();
      }
    } catch {
      // Fall through to raw response body.
    }

    return body;
  } catch {
    return fallback;
  }
}

export default function Page() {
  const [allArticles, setAllArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFallbackBanner, setShowFallbackBanner] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterKey>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilterKey>('all');
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
  const hasHydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);

  const filteredArticles = useMemo(() => {
    const categoryFiltered =
      categoryFilter === 'all'
        ? allArticles
        : allArticles.filter((article) => article.category.toLowerCase() === categoryFilter);

    if (priorityFilter === 'all') return categoryFiltered;

    const targetImportance =
      priorityFilter === 'breaking' ? 1 : priorityFilter === 'important' ? 2 : 3;

    return [...categoryFiltered].sort((a, b) => {
      const aRank = a.importance === targetImportance ? 0 : 1;
      const bRank = b.importance === targetImportance ? 0 : 1;

      if (aRank !== bRank) return aRank - bRank;
      return a.importance - b.importance;
    });
  }, [allArticles, categoryFilter, priorityFilter]);

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
        setFeedError(await readApiError(res, 'Unable to load feed sources'));
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

      // Patch changed sources.
      for (const source of draftFeedSources) {
        const base = baseMap.get(source.id);
        if (!base) continue;
        if (feedSignature([base]) === feedSignature([source])) continue;

        const res = await fetch(`/api/feeds/${source.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: source.name,
            type: source.type,
            url: source.url,
            enabled: source.enabled,
            category: source.category,
            apiKeyEnv: source.apiKeyEnv,
            priority: source.priority,
          }),
        });

        if (!res.ok) {
          const message = await readApiError(res, `Failed to update ${source.name}`);
          throw new Error(`Failed to update ${source.name}: ${message}`);
        }
      }

      await loadFeedSources();
      await refresh();
    } catch (error) {
      setFeedError(
        error instanceof Error ? error.message : 'Failed to apply feed changes',
      );
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
        <HeaderFilters
          categoryFilter={categoryFilter}
          priorityFilter={priorityFilter}
          categoryOptions={categoryFilterOptions}
          priorityOptions={priorityFilterOptions}
          onCategoryChange={setCategoryFilter}
          onPriorityChange={setPriorityFilter}
        />
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
              feedSaving={feedSaving}
              hasPendingFeedChanges={hasPendingFeedChanges}
              feedLoading={feedLoading}
              draftFeedSources={draftFeedSources}
              toggleFeedEnabled={toggleFeedEnabled}
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

'use client';

import { memo, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';

import { marketRows as staticMarketRows } from '@/services/news';
import { useSpeechReader } from '@/hooks/useSpeechReader';
import type { MarketRow, NewsArticle } from '@/types';

import { MarketSnapshotModal } from '@/components/market/MarketSnapshot';
import { NewsCard } from '@/components/news/NewsCard';
import { HeaderFilters } from '@/components/ui/HeaderFilters';
import PulseHeader from '@/components/pulse/PulseHeader';
import MacroPageClient from '@/components/macro/MacroPageClient';
import { VoicePlayer } from '@/modules/VoicePlayer';
import type { MacroArticleResponse } from '@/types/macro';
import { HeroCard } from '@/components/news/HeroCard';
import './live-feed.css';

const CUSTOM_SYMBOLS_KEY = 'finpuls-custom-symbols';

function loadStoredSymbols(): Array<{ symbol: string; label: string }> {
  try { return JSON.parse(localStorage.getItem(CUSTOM_SYMBOLS_KEY) ?? '[]'); } catch { return []; }
}

function saveStoredSymbols(list: Array<{ symbol: string; label: string }>) {
  try { localStorage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify(list)); } catch {}
}

interface MarketResponse {
  marketRows: MarketRow[];
  live: boolean;
}

interface NewsResponse {
  articles: NewsArticle[];
  usingFallback: boolean;
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

function clientRelativeTime(publishedAt: string | undefined, fallback: string): string {
  if (!publishedAt) return fallback;
  const diff = (Date.now() - new Date(publishedAt).getTime()) / 1000;
  if (diff < 0 || Number.isNaN(diff)) return fallback;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface PageClientProps {
  initialArticles: NewsArticle[];
  macroInitial: MacroArticleResponse;
}

const EmbeddedMacroWidget = memo(function EmbeddedMacroWidget({
  initial,
}: {
  initial: MacroArticleResponse;
}) {
  return (
    <section className="widget macro-landscape-widget">
      <MacroPageClient initial={initial} />
    </section>
  );
});

export default function PageClient({ initialArticles, macroInitial }: PageClientProps) {
  const [allArticles, setAllArticles] = useState<NewsArticle[]>(initialArticles);
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterKey>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilterKey>('all');
  const [hydrated, setHydrated] = useState(false);
  const [, setTick] = useState(0);
  const [marketRows, setMarketRows] = useState<MarketRow[]>(staticMarketRows);
  const [marketLive, setMarketLive] = useState(false);
  const [loadingMarketNames, setLoadingMarketNames] = useState<Set<string>>(new Set());
  const [showMarketModal, setShowMarketModal] = useState(false);

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
      const aMs = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bMs = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bMs - aMs;
    });
  }, [allArticles, categoryFilter, priorityFilter]);

  const filterKey = `${categoryFilter}:${priorityFilter}`;
  const speech = useSpeechReader(filteredArticles, filterKey);
  const newsFeedRef = useRef<HTMLDivElement | null>(null);
  const controlsHolderRef = useRef<HTMLDivElement | null>(null);

  function relativeTimeFor(article: NewsArticle): string {
    return hydrated ? clientRelativeTime(article.publishedAt, article.time) : article.time;
  }

  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch('/api/news', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = (await res.json()) as NewsResponse;
        if (Array.isArray(data.articles) && typeof data.usingFallback === 'boolean') {
          setAllArticles(data.articles);
        }
      }
    } catch {
      // Keep showing last state on error.
    } finally {
      setLoading(false);
    }
  }

  async function refreshMarket() {
    try {
      const res = await fetch('/api/market', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as MarketResponse;
      const storedLabels = new Set(loadStoredSymbols().map((s) => s.label));
      setMarketRows((prev) => [...data.marketRows, ...prev.filter((r) => storedLabels.has(r.name))]);
      setMarketLive(data.live);
    } catch {
      // Keep showing last state on error.
    }
  }

  async function fetchAndInsertSymbol(symbol: string, label: string) {
    setMarketRows((prev) => prev.some((r) => r.name === label) ? prev : [...prev, { name: label, value: '–', change: '–', direction: 'pos' }]);
    setLoadingMarketNames((prev) => new Set(prev).add(label));
    try {
      const res = await fetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}&label=${encodeURIComponent(label)}`);
      if (res.ok) {
        const data = (await res.json()) as { row: MarketRow };
        setMarketRows((prev) => prev.map((r) => r.name === label ? data.row : r));
      } else {
        setMarketRows((prev) => prev.filter((r) => r.name !== label));
      }
    } catch {
      setMarketRows((prev) => prev.filter((r) => r.name !== label));
    } finally {
      setLoadingMarketNames((prev) => { const s = new Set(prev); s.delete(label); return s; });
    }
  }

  async function handleAddSymbol(symbol: string, label: string) {
    if (marketRows.some((r) => r.name === label)) return;
    const stored = loadStoredSymbols();
    if (!stored.some((s) => s.label === label)) saveStoredSymbols([...stored, { symbol, label }]);
    await fetchAndInsertSymbol(symbol, label);
  }

  function handleRemoveSymbol(name: string) {
    setMarketRows((prev) => prev.filter((r) => r.name !== name));
    const stored = loadStoredSymbols();
    const updated = stored.filter((s) => s.label !== name);
    if (updated.length !== stored.length) saveStoredSymbols(updated);
  }

  const restoreUserSymbols = useEffectEvent(async () => {
    const stored = loadStoredSymbols();
    if (stored.length === 0) return;
    await Promise.allSettled(stored.map(({ symbol, label }) => fetchAndInsertSymbol(symbol, label)));
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshMarket();
    void restoreUserSymbols();
    const id = window.setInterval(() => { void refreshMarket(); }, 15_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!speech.autoplay || !speech.isPlaying) return;

    const feedEl = newsFeedRef.current;
    const controlsEl = controlsHolderRef.current;
    if (!feedEl) return;

    const alignReadingCard = () => {
      const currentCard = feedEl.querySelector<HTMLElement>('.news-card.is-reading');
      if (!currentCard) return;

      const feedRect = feedEl.getBoundingClientRect();
      const cardRect = currentCard.getBoundingClientRect();
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

      let occludedTop = 0;

      const headerEl = document.querySelector<HTMLElement>('header');
      if (headerEl) {
        const headerRect = headerEl.getBoundingClientRect();
        if (headerRect.bottom > 0) {
          occludedTop = Math.max(occludedTop, headerRect.bottom);
        }
      }

      if (controlsEl) {
        const controlsRect = controlsEl.getBoundingClientRect();
        const controlsStyle = window.getComputedStyle(controlsEl);
        const stickyTop = Number.parseFloat(controlsStyle.top || '0') || 0;
        const isSticky = controlsStyle.position === 'sticky';
        const isPinned = isSticky && controlsRect.top <= stickyTop + 1;

        if (isPinned && controlsRect.bottom > 0) {
          occludedTop = Math.max(occludedTop, controlsRect.bottom);
        }
      }

      const mobileTopGap = window.matchMedia('(max-width: 960px)').matches ? 12 : 0;
      const visibleTop = Math.max(feedRect.top, occludedTop + mobileTopGap);
      const visibleBottom = Math.min(feedRect.bottom, viewportHeight);

      if (visibleBottom <= visibleTop) return;

      const visibleFeedCenter = visibleTop + (visibleBottom - visibleTop) / 2;
      const cardCenter = cardRect.top + cardRect.height / 2;
      const delta = cardCenter - visibleFeedCenter;

      if (Math.abs(delta) < 2) return;

      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({
        top: window.scrollY + delta,
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    };

    const raf1 = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(alignReadingCard);
    });
    const timer = window.setTimeout(alignReadingCard, 80);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.clearTimeout(timer);
    };
  }, [speech.autoplay, speech.isPlaying, speech.currentArticleId]);

  const hero = allArticles[0] ?? null;

  return (
    <>
      <PulseHeader />

      <main className="live-feed-page">
        <div className="live-feed-layout">
          <div className="live-feed-main">
            <div className="controls-holder" ref={controlsHolderRef}>
              <VoicePlayer speech={speech} />
              <div className="controls-filters-row">
                <button
                  className="ms-snapshot-btn"
                  onClick={() => setShowMarketModal(true)}
                  aria-haspopup="dialog"
                  aria-label="Open market snapshot"
                >
                  <svg width="13" height="11" viewBox="0 0 13 11" fill="currentColor" aria-hidden="true">
                    <rect x="0" y="6" width="3" height="5" rx="0.5" />
                    <rect x="5" y="3" width="3" height="8" rx="0.5" />
                    <rect x="10" y="0" width="3" height="11" rx="0.5" />
                  </svg>
                  Market Snapshot
                </button>
                <HeaderFilters
                  categoryFilter={categoryFilter}
                  priorityFilter={priorityFilter}
                  categoryOptions={categoryFilterOptions}
                  priorityOptions={priorityFilterOptions}
                  onCategoryChange={setCategoryFilter}
                  onPriorityChange={setPriorityFilter}
                />
              </div>
            </div>

            {hero && (
              <HeroCard
                article={hero}
                onRead={speech.readById}
                relativeTime={relativeTimeFor(hero)}
                variant="live-feed"
              />
            )}

            <div className="data-status-row" aria-live="polite">
              <h1 className="data-status-badge live">Live News Feed</h1>
            </div>

            <div className="news-feed" ref={newsFeedRef}>
              {loading && allArticles.length === 0 && [1, 2, 3].map((n) => <div key={n} className="loading-card skeleton-block" />)}

              {!loading && filteredArticles.length === 0 && (
                <div className="empty-state">No stories match this filter.</div>
              )}

              {filteredArticles.map((article) => (
                <NewsCard
                  key={article.id}
                  article={article}
                  isReading={speech.currentArticleId === article.id}
                  onRead={speech.readById}
                  relativeTime={relativeTimeFor(article)}
                />
              ))}
            </div>
          </div>

          <aside className="live-feed-aside">
            <EmbeddedMacroWidget initial={macroInitial} />
          </aside>
        </div>
      </main>
      {showMarketModal && (
        <MarketSnapshotModal
          rows={marketRows}
          isLive={marketLive}
          loadingNames={loadingMarketNames}
          onAdd={handleAddSymbol}
          onRemove={handleRemoveSymbol}
          onClose={() => setShowMarketModal(false)}
        />
      )}
    </>
  );
}

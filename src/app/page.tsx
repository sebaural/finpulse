'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { loadNewsArticles, tickerItems as staticTickerItems, marketRows as staticMarketRows } from '../services/news';
import { useSpeechReader } from '../hooks/useSpeechReader';
import type { MarketRow, NewsArticle, TickerItem } from '../types';

import { MarketTicker } from '@/components/market/MarketTicker';
import { MarketSnapshot } from '@/components/market/MarketSnapshot';
import { NewsCard } from '@/components/news/NewsCard';
import { HeroCard } from '@/components/news/HeroCard';
import { SidebarNewsItem } from '@/components/news/SidebarNewsItem';
import { HeaderFilters } from '@/components/ui/HeaderFilters';
import NavMenu from '@/components/NavMenu';

const VoicePlayer = dynamic<{ speech: ReturnType<typeof useSpeechReader> }>(
  () => import('@/modules/VoicePlayer').then((mod) => mod.VoicePlayer),
  { ssr: false },
);

interface MarketResponse {
  tickerItems: TickerItem[];
  marketRows: MarketRow[];
  cachedAt: string;
  live: boolean;
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

export default function Page() {
  const [allArticles, setAllArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFallbackBanner, setShowFallbackBanner] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterKey>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilterKey>('all');
  const [, setTick] = useState(0);
  const [tickerItems, setTickerItems] = useState<TickerItem[]>(staticTickerItems);
  const [marketRows, setMarketRows] = useState<MarketRow[]>(staticMarketRows);
  const [marketLive, setMarketLive] = useState(false);

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

  const speech = useSpeechReader(filteredArticles);
  const newsFeedRef = useRef<HTMLDivElement | null>(null);
  const controlsHolderRef = useRef<HTMLDivElement | null>(null);

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

      // On mobile, sticky header/player cover part of the viewport.
      // Use the first actually visible y-position as the top bound.
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

    // Mobile layout/sticky positioning can settle a bit later than one frame.
    const raf1 = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(alignReadingCard);
    });
    const timer = window.setTimeout(alignReadingCard, 80);

    return () => {
      window.cancelAnimationFrame(raf1);
      window.clearTimeout(timer);
    };
  }, [speech.autoplay, speech.isPlaying, speech.currentArticleId]);

  return (
    <>
      <MarketTicker items={tickerItems} />

      <header>
        <div className="header-inner">
          <div className="logo">
            <Image src="/macrostance-logo.png" alt="MacroStance mark" className="logo-mark" width={40} height={40} priority />
            <span>MacroStance</span>
          </div>
          <NavMenu />
        </div>
      </header>

      <div className="page">
        <div className="layout">
          <div className="main-content">
            <div className="controls-holder" ref={controlsHolderRef}>
              <VoicePlayer speech={speech} />
              <HeaderFilters
                categoryFilter={categoryFilter}
                priorityFilter={priorityFilter}
                categoryOptions={categoryFilterOptions}
                priorityOptions={priorityFilterOptions}
                onCategoryChange={setCategoryFilter}
                onPriorityChange={setPriorityFilter}
              />
            </div>
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

            <div className="news-feed" ref={newsFeedRef}>
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
                    onRead={speech.readById}
                    relativeTime={clientRelativeTime(article.publishedAt, article.time)}
                  />
                ))}
            </div>
          </div>

          <aside className="sidebar">
            <MarketSnapshot rows={marketRows} isLive={marketLive} />

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

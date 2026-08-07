'use client';

import Image from 'next/image';
import { memo, useEffect, useEffectEvent, useState } from 'react';

const CUSTOM_SYMBOLS_KEY = 'finpuls-custom-symbols';

function loadStoredSymbols(): Array<{ symbol: string; label: string }> {
  try { return JSON.parse(localStorage.getItem(CUSTOM_SYMBOLS_KEY) ?? '[]'); } catch { return []; }
}

function saveStoredSymbols(list: Array<{ symbol: string; label: string }>) {
  try { localStorage.setItem(CUSTOM_SYMBOLS_KEY, JSON.stringify(list)); } catch {}
}

import { tickerItems as staticTickerItems, marketRows as staticMarketRows } from '@/services/news';
import type { MarketRow, NewsArticle, TickerItem } from '@/types';

import { MarketTicker } from '@/components/market/MarketTicker';
import { MarketSnapshot } from '@/components/market/MarketSnapshot';
import { HeroCard } from '@/components/news/HeroCard';
import NavMenu from '@/components/topNav/NavMenu';
import { PulseHighlights } from '@/components/pulse/PulseHighlights';
import MacroPageClient from '@/components/macro/MacroPageClient';
import type { PulseArticle, PulseSlug } from '@/types/pulse';
import type { MacroArticleResponse } from '@/types/macro';

interface MarketResponse {
  tickerItems: TickerItem[];
  marketRows: MarketRow[];
  cachedAt: string;
  live: boolean;
}

interface NewsResponse {
  articles: NewsArticle[];
  usingFallback: boolean;
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

// Structural shape of a topic-linked article passed from the server shell.
// Kept local (not imported from the generated Prisma client) so this client
// component stays decoupled from the DB layer — the server passes the richer
// Prisma rows, which are assignable to this.
interface TopicAnalysisItem {
  id: string;
  slug: string;
  title: string;
  createdAt: Date;
  topic: { slug: string; name: string };
}

interface HomeClientProps {
  initialArticles: NewsArticle[];
  initialUsingFallback: boolean;
  topicAnalysis: TopicAnalysisItem[];
  pulseLatest: Record<PulseSlug, PulseArticle | null>;
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

export default function HomeClient({
  initialArticles,
  initialUsingFallback,
  topicAnalysis,
  pulseLatest,
  macroInitial,
}: HomeClientProps) {
  // Editorial deep-dive grid: topic-linked briefings route to
  // /topics/[topicSlug]/[articleSlug]. One latest article is shown for each
  // available topic, already sorted by recency on the server.
  const [allArticles, setAllArticles] = useState<NewsArticle[]>(initialArticles);
  const [showFallbackBanner, setShowFallbackBanner] = useState(initialUsingFallback);
  const [hydrated, setHydrated] = useState(false);
  const [, setTick] = useState(0);
  const [tickerItems, setTickerItems] = useState<TickerItem[]>(staticTickerItems);
  const [marketRows, setMarketRows] = useState<MarketRow[]>(staticMarketRows);
  const [marketLive, setMarketLive] = useState(false);
  const [loadingMarketNames, setLoadingMarketNames] = useState<Set<string>>(new Set());

  const hero = allArticles[0] ?? null;

  function relativeTimeFor(article: NewsArticle): string {
    return hydrated ? clientRelativeTime(article.publishedAt, article.time) : article.time;
  }

  async function refresh() {
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
          setShowFallbackBanner(data.usingFallback);
        }
      }
    } catch {
      // Keep showing last state on error.
    }
  }

  async function refreshMarket() {
    try {
      const res = await fetch('/api/market', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as MarketResponse;
      const storedLabels = new Set(loadStoredSymbols().map((s) => s.label));
      setMarketRows((prev) => [...data.marketRows, ...prev.filter((r) => storedLabels.has(r.name))]);
      setTickerItems((prev) => [...data.tickerItems, ...prev.filter((t) => storedLabels.has(t.symbol))]);
      setMarketLive(data.live);
    } catch {
      // Keep showing last state on error.
    }
  }

  async function fetchAndInsertSymbol(symbol: string, label: string) {
    setMarketRows((prev) => prev.some((r) => r.name === label) ? prev : [...prev, { name: label, value: '–', change: '–', direction: 'pos' }]);
    setTickerItems((prev) => prev.some((t) => t.symbol === label) ? prev : [...prev, { symbol: label, value: '–', change: '–', direction: 'pos' }]);
    setLoadingMarketNames((prev) => new Set(prev).add(label));
    try {
      const res = await fetch(`/api/market/quote?symbol=${encodeURIComponent(symbol)}&label=${encodeURIComponent(label)}`);
      if (res.ok) {
        const data = (await res.json()) as { row: MarketRow; ticker: TickerItem };
        setMarketRows((prev) => prev.map((r) => r.name === label ? data.row : r));
        setTickerItems((prev) => prev.map((t) => t.symbol === label ? data.ticker : t));
      } else {
        setMarketRows((prev) => prev.filter((r) => r.name !== label));
        setTickerItems((prev) => prev.filter((t) => t.symbol !== label));
      }
    } catch {
      setMarketRows((prev) => prev.filter((r) => r.name !== label));
      setTickerItems((prev) => prev.filter((t) => t.symbol !== label));
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
    setTickerItems((prev) => prev.filter((t) => t.symbol !== name));
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

  return (
    <>
      <MarketTicker items={tickerItems} />

      <header>
        <div className="header-inner">
          <div className="logo">
            <Image src="/macrostance-logo.png" alt="MacroStance mark" className="logo-mark" width={40} height={40} priority />
            <h1>MacroStance</h1>
          </div>
          <NavMenu />
        </div>
      </header>

      <main className="page HomePage">
        <div className="layout">
          <div className="main-content">

            <EmbeddedMacroWidget initial={macroInitial} />

            {topicAnalysis.length > 0 && (
              <section className="widget topic-analysis">
                <h2 className="widget-title">Deep-Dive Analysis</h2>
                {topicAnalysis.map((item) => (
                  <a
                    key={item.id}
                    className="side-story"
                    href={`/topics/${item.topic!.slug}/${item.slug}`}
                    style={{ display: 'block', textDecoration: 'none' }}
                  >
                    <div className="side-story-source">{item.topic!.name}</div>
                    <div className="side-story-title">{item.title}</div>
                  </a>
                ))}
              </section>
            )}

          </div>

          <aside className="sidebar">
            <MarketSnapshot
                rows={marketRows}
                isLive={marketLive}
                loadingNames={loadingMarketNames}
                onAdd={handleAddSymbol}
                onRemove={handleRemoveSymbol}
              />

              <PulseHighlights latestByCategory={pulseLatest} />

          {hero && (
              <HeroCard article={hero} relativeTime={relativeTimeFor(hero)} />
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

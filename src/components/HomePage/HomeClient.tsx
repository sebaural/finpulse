'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useEffectEvent, useState } from 'react';

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
import type { PulseArticle, PulseSlug } from '@/types/pulse';
import './HomePage.css';

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

interface HomeClientProps {
  initialArticles: NewsArticle[];
  initialUsingFallback: boolean;
  pulseLatest: Record<PulseSlug, PulseArticle | null>;
}

export default function HomeClient({
  initialArticles,
  initialUsingFallback,
  pulseLatest,
}: HomeClientProps) {
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

  function pulseHref(slug: PulseSlug): string {
    const article = pulseLatest[slug];
    return article ? `/pulse/${slug}/${article.articleSlug}` : `/pulse/${slug}`;
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

            <section className="hero">
              <h1>Real-time intelligence at the intersection of markets, policy, and technology.</h1>
              <p>
                MacroStance delivers real-time financial news and deep-dive
                analysis at the intersection of global markets, policy, and
                technology.
              </p>
            </section>

            <div className="sections">

              {/* Daily Briefing */}
              <article className="hub-card" id="daily-briefing">
                <div className="hub-body">
                  <div className="icon-frame">
                    <svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Globe with regional markers above a dated archive strip, representing the daily geopolitics briefing">
                      <circle cx="110" cy="88" r="48" stroke="var(--accent2)" strokeWidth="3" />
                      <ellipse cx="110" cy="88" rx="18" ry="48" stroke="var(--accent2)" strokeWidth="1.5" opacity="0.5" />
                      <line x1="62" y1="88" x2="158" y2="88" stroke="var(--accent2)" strokeWidth="1.5" opacity="0.5" />
                      <circle cx="95" cy="68" r="5" fill="var(--accent)" />
                      <circle cx="128" cy="72" r="5" fill="var(--accent)" />
                      <circle cx="100" cy="108" r="5" fill="var(--accent)" />
                      <circle cx="78" cy="92" r="5" fill="var(--accent)" />
                      <circle className="ping-ring" cx="140" cy="95" r="8" fill="none" stroke="var(--accent)" strokeWidth="2" />
                      <circle cx="140" cy="95" r="5" fill="var(--accent)" />
                      <rect x="41" y="150" width="18" height="18" rx="3" stroke="var(--accent2)" strokeWidth="1.5" />
                      <rect x="65" y="150" width="18" height="18" rx="3" stroke="var(--accent2)" strokeWidth="1.5" />
                      <rect x="89" y="150" width="18" height="18" rx="3" stroke="var(--accent2)" strokeWidth="1.5" />
                      <rect x="113" y="150" width="18" height="18" rx="3" stroke="var(--accent2)" strokeWidth="1.5" />
                      <rect x="137" y="150" width="18" height="18" rx="3" stroke="var(--accent2)" strokeWidth="1.5" />
                      <rect x="161" y="150" width="18" height="18" rx="3" fill="var(--accent)" />
                    </svg>
                  </div>
                  <div className="hub-content">
                    <h2>Daily Briefing</h2>
                    <p className="section-desc">
                      We lead with the day&apos;s biggest geopolitical story,
                      followed by a rapid roundup of key developments across
                      the globe. Published every weekday, with a fully
                      searchable archive.
                    </p>
                  </div>
                  <div className="cta-holder">
                    <Link className="cta-btn cta-daily-briefing" href="/overview">
                      Read the Daily Briefing
                      <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </Link>
                  </div>
                </div>
              </article>

              {/* News Pulse */}
              <article className="hub-card reverse" id="news-pulse">
                <div className="hub-body">
                  <div className="icon-frame">
                    <svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Pulse waveform icon representing breaking headlines">
                      <path d="M15,112 L55,112 L65,82 L75,142 L85,60 L95,150 L105,112 L130,112 L145,97 L155,117 L165,107 L205,107"
                            stroke="var(--accent2)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle className="ping-ring" cx="85" cy="60" r="6" fill="none" stroke="var(--accent)" strokeWidth="2" />
                      <circle cx="85" cy="60" r="4.5" fill="var(--accent)" />
                    </svg>
                  </div>
                  <div className="hub-content">
                    <h2>News Pulse</h2>
                    <p className="section-desc">
                      Pulse dissects the news through the lens of key
                      stakeholders, their core theses, and their rhetoric.
                      Every edition transforms complex daily conflicts into
                      clear breakdowns and projects the two macro-narratives
                      shaping where the world is heading.
                    </p>
                  </div>
                  <div className="cta-holder">
                    <Link className="pulse-cta-btn pulse-cta-politics" href={pulseHref('politics')}>
                      Politics
                      <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </Link>
                    <Link className="pulse-cta-btn pulse-cta-economy" href={pulseHref('economy')}>
                      Economy
                      <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </Link>
                    <Link className="pulse-cta-btn pulse-cta-technology" href={pulseHref('technology')}>
                      Technology
                      <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </Link>
                    <Link className="pulse-cta-btn pulse-cta-information" href={pulseHref('information')}>
                      Information
                      <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </Link>
                  </div>
                </div>
              </article>

              {/* Deep-Dive Analysis */}
              <article className="hub-card" id="deep-dive-analysis">
                <div className="hub-body">
                  <div className="icon-frame">
                    <svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Magnifying glass over layered strata representing deep analysis">
                      <rect x="35" y="128" width="150" height="12" rx="6" fill="var(--accent)" opacity="0.22" />
                      <rect x="50" y="150" width="120" height="12" rx="6" fill="var(--accent)" opacity="0.4" />
                      <rect x="65" y="172" width="90" height="12" rx="6" fill="var(--accent)" opacity="0.58" />
                      <rect x="80" y="194" width="60" height="12" rx="6" fill="var(--accent)" opacity="0.78" />
                      <line x1="150" y1="65" x2="112" y2="123" stroke="var(--accent2)" strokeWidth="1.6" strokeDasharray="3 5" opacity="0.55" />
                      <circle cx="150" cy="65" r="26" fill="var(--accent2)" fillOpacity="0.08" stroke="var(--accent2)" strokeWidth="3.5" />
                      <line x1="168" y1="83" x2="196" y2="111" stroke="var(--accent2)" strokeWidth="5.5" strokeLinecap="round" />
                    </svg>
                  </div>
                  <div className="hub-content">
                    <h2>Deep-Dive Analysis</h2>
                    <p className="section-desc">
                      Every Deep-Dive Analysis dissects a defining issue
                      through its historical roots and the competing
                      incentives of key players, revealing the structural
                      forces shaping geopolitics, macroeconomics, technology,
                      and global policy.
                    </p>
                  </div>
                  <div className="cta-holder">
                    <Link className="cta-btn cta-deep-dive-analysis" href="/deep-dive-analysis">
                      Follow the Threads
                      <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </Link>
                  </div>
                </div>
              </article>

              {/* The Macro Landscape */}
              <article className="hub-card reverse" id="macro-landscape">
                <div className="hub-body">
                  <div className="icon-frame">
                    <svg viewBox="0 0 220 220" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="City skyline at sunrise above a candlestick chart, representing the daily macro narrative">
                      <circle cx="110" cy="68" r="28" fill="var(--accent)" fillOpacity="0.07" stroke="var(--accent)" strokeWidth="2.5" />
                      <line x1="110" y1="30" x2="110" y2="18" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                      <line x1="85" y1="38" x2="76" y2="28" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />
                      <line x1="135" y1="38" x2="144" y2="28" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" />

                      <rect x="25" y="92" width="16" height="40" fill="var(--surface)" stroke="var(--accent2)" strokeWidth="2" />
                      <rect x="48" y="107" width="13" height="25" fill="var(--surface)" stroke="var(--accent2)" strokeWidth="2" />
                      <rect x="68" y="74" width="20" height="58" fill="var(--surface)" stroke="var(--accent2)" strokeWidth="2" />
                      <rect x="150" y="100" width="15" height="32" fill="var(--surface)" stroke="var(--accent2)" strokeWidth="2" />
                      <rect x="172" y="112" width="17" height="20" fill="var(--surface)" stroke="var(--accent2)" strokeWidth="2" />

                      <line x1="15" y1="132" x2="205" y2="132" stroke="var(--muted)" strokeWidth="1.5" />

                      <g strokeWidth="1.4">
                        <line x1="34" y1="146" x2="34" y2="176" stroke="var(--positive)" />
                        <rect x="30" y="151" width="8" height="18" fill="var(--positive)" />
                        <line x1="64" y1="151" x2="64" y2="191" stroke="var(--negative)" />
                        <rect x="60" y="161" width="8" height="22" fill="var(--negative)" />
                        <line x1="99" y1="141" x2="99" y2="171" stroke="var(--positive)" />
                        <rect x="95" y="146" width="8" height="16" fill="var(--positive)" />
                        <line x1="134" y1="156" x2="134" y2="186" stroke="var(--negative)" />
                        <rect x="130" y="163" width="8" height="15" fill="var(--negative)" />
                        <line x1="169" y1="143" x2="169" y2="179" stroke="var(--positive)" />
                        <rect x="165" y="151" width="8" height="20" fill="var(--positive)" />
                      </g>
                    </svg>
                  </div>
                  <div className="hub-content">
                    <h2>The Macro Landscape</h2>
                    <p className="section-desc">
                      Each Landscape briefing distills overnight market
                      movements into a single, cohesive narrative spanning a
                      vast array of catalysts—from macroeconomic policy and
                      corporate earnings to currency shifts, geopolitical
                      headlines, and sector rotations.
                    </p>
                  </div>
                  <div className="cta-holder">
                    <Link className="cta-btn cta-macro-landscape" href="/macro-landscape">
                      Read Today&apos;s Landscape
                      <svg viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </Link>
                  </div>
                </div>
              </article>

            </div>

          </div>

          <aside className="sidebar">
            <MarketSnapshot
                rows={marketRows}
                isLive={marketLive}
                loadingNames={loadingMarketNames}
                onAdd={handleAddSymbol}
                onRemove={handleRemoveSymbol}
              />

          {hero && (
              <HeroCard article={hero} relativeTime={relativeTimeFor(hero)} />
            )}
          </aside>
        </div>
      </main>
    </>
  );
}

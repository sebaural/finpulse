import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import './about.css';

export const metadata: Metadata = {
  title: 'About Us — MacroStance',
  description:
    'MacroStance is an independent financial news aggregator serving traders, analysts, and market observers with real-time data and global market coverage.',
};

const CATEGORIES = [
  'Markets', 'Economy', 'Equities', 'Forex',
  'Commodities', 'Crypto', 'Geopolitics', 'Technology', 'Energy',
];

const STATS = [
  { value: '12,000+', desc: 'Articles indexed' },
  { value: '9',       desc: 'Market categories' },
  { value: '15 min',  desc: 'Average refresh interval' },
  { value: '24 / 7',  desc: 'Global market coverage' },
  { value: '50+',     desc: 'Tracked news sources' },
];

const PRINCIPLES = [
  'Editorial neutrality — no views, no positions',
  'Real-time aggregation across global newswire',
  'AI-assisted curation with editorial oversight',
  'Clean signal — no noise, no clickbait',
];

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <div className="page about-page">
      {/* Hero */}
      <div className="about-hero">
        <span className="about-eyebrow">Who We Are</span>
        <h1 className="about-h1">About MacroStance</h1>
        <p className="about-tagline">
          Independent financial intelligence for traders, analysts, and market
          observers — delivered in real time.
        </p>
      </div>

      {/* Two-column body */}
      <div className="about-body">
        {/* Left: editorial text */}
        <div className="about-text">
          <h2>Our Mission</h2>
          <p>
            MacroStance was founded on a simple premise: markets move fast, and
            the people who follow them deserve information that keeps pace. We
            aggregate and surface the highest-signal financial headlines from
            across the global newswire — equities, macro, commodities, forex,
            crypto, and beyond — and present them in a clean, distraction-free
            interface built for speed and clarity.
          </p>
          <p>
            We are editorially neutral. MacroStance does not take positions,
            promote securities, or editorialize on market outcomes. Our role is
            to surface what is being said, across the full spectrum of global
            financial media, so you can form your own view.
          </p>
          <p>
            Behind MacroStance is a small, globally distributed team of
            engineers and researchers who believe that access to high-quality
            market intelligence should not be gated behind expensive terminals
            or noisy aggregators. We build for focus: one interface, every
            signal that matters.
          </p>

          <h2>What We Cover</h2>
          <div className="about-categories">
            {CATEGORIES.map((cat) => (
              <span key={cat} className="about-category-tag">{cat}</span>
            ))}
          </div>

          <h2>Our Approach</h2>
          <p>
            Every headline on MacroStance is processed through an AI-assisted
            aggregation pipeline that scores articles for relevance, recency,
            and market impact — then surfaced for review against editorial
            guidelines. The result is a feed that reads like a human curated
            it, at a speed no human team could match. Stories are refreshed
            continuously throughout the trading day.
          </p>
          <p>
            We work only with reputable source outlets and apply strict
            filtering to remove duplicates, low-quality rewrites, and
            promotional content before anything reaches your feed.
          </p>

          <div className="about-meta-row">
            <div className="about-meta-item">
              <span className="about-meta-label">Founded</span>
              <span className="about-meta-value">2024</span>
            </div>
            <div className="about-meta-item">
              <span className="about-meta-label">Headquarters</span>
              <span className="about-meta-value">Digital-first, globally distributed</span>
            </div>
          </div>
        </div>

        {/* Right: stats panel */}
        <aside className="about-stats-panel">
          <div className="about-stats-card">
            <div className="about-stats-header">
              <span className="about-stats-label">Platform at a Glance</span>
              <span className="about-live-dot" aria-hidden="true" />
            </div>
            {STATS.map(({ value, desc }) => (
              <div key={desc} className="about-stat">
                <span className="about-stat-value">{value}</span>
                <span className="about-stat-desc">{desc}</span>
              </div>
            ))}
          </div>

          <div className="about-principles-card">
            <span className="about-stats-label about-principles-label">
              Core Principles
            </span>
            {PRINCIPLES.map((text) => (
              <div key={text} className="about-principle-row">
                <span className="about-principle-icon" aria-hidden="true">◈</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
    </>
  );
}

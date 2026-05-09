import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { buildMetadata, jsonLd, breadcrumbSchema, canonicalUrl } from '@/lib/seo';
import './about.css';

export const metadata: Metadata = buildMetadata({
  title: 'About MacroStance — Independent Financial News & Market Intelligence',
  description:
    'Learn about MacroStance: an independent financial news platform aggregating real-time headlines, market data, and macro signals from 50+ trusted global sources.',
  path: '/about',
  ogTitle:
    'About MacroStance — Independent Real-Time Financial News for Traders & Analysts',
  ogDescription:
    'Meet the team and methodology behind MacroStance: an editorially neutral financial news platform built for speed, signal quality, and global market breadth.',
});

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
  'Clean signal — no noise, no clickbait',
];

// const TEAM = [
//   {
//     name: '[Editorial Lead]',
//     title: 'Head of Editorial',
//     credential:
//       '[Placeholder bio: 10+ years covering global markets at a major financial publication; CFA Level III candidate. Replace with real bio.]',
//   },
//   {
//     name: '[Markets Editor]',
//     title: 'Markets & Macro Editor',
//     credential:
//       '[Placeholder bio: Former buy-side analyst with experience in equities and FX desks. Replace with real bio.]',
//   },
//   {
//     name: '[Engineering Lead]',
//     title: 'Head of Engineering',
//     credential:
//       '[Placeholder bio: Built data pipelines and real-time systems at fintech firms. Replace with real bio.]',
//   },
// ];

const breadcrumbs = breadcrumbSchema([
  { name: 'Home', url: canonicalUrl('/') },
  { name: 'About', url: canonicalUrl('/about') },
]);

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <main className="page about-page">
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
              MacroStance was founded on a simple premise: markets move fast,
              and the people who follow them deserve information that keeps
              pace. We aggregate and surface the highest-signal financial
              headlines from across the global newswire — equities, macro,
              commodities, forex, crypto, and beyond — and present them in a
              clean, distraction-free interface built for speed and clarity.
            </p>
            <p>
              We are editorially neutral. MacroStance does not take positions,
              promote securities, or editorialize on market outcomes. Our role
              is to surface what is being said, across the full spectrum of
              global financial media, so you can form your own view.
            </p>

            <h2>Experience</h2>
            <p>
              MacroStance was built by people who have spent years close to
              markets — on trading floors, in analyst seats, in quantitative
              research, and inside fintech engineering teams. We are not a
              generic news aggregator built by a generic content team; the
              product reflects the daily workflow of professional market
              participants who were frustrated by the noise, latency, and
              upsell pressure of existing tools.
            </p>
            <p>
              That frustration is the product&apos;s origin story. Members of
              the founding team — veterans of equity trading desks, sell-side
              research, and fintech engineering — watched colleagues lose
              minutes per hour wading through marketing-driven feeds, paywalled
              terminals, and SEO-optimized clickbait. MacroStance is what we
              wished existed when we were trading the open.
            </p>

            <h2>Expertise</h2>
            <p>
              Our editorial methodology is documented and reproducible. Every
              headline that reaches the feed has passed through a multi-stage
              filter:
            </p>
            <ul className="about-list">
              <li>
                <strong>Source vetting:</strong> Sources must be either tier-1
                wire services, recognized financial publications with named
                editorial leadership, or primary issuers (central banks,
                regulators, exchanges).
              </li>
              <li>
                <strong>Duplicate suppression:</strong> Near-identical rewrites
                of the same wire story are collapsed into a single entry with
                attribution preserved.
              </li>
              <li>
                <strong>Signal classification:</strong> Headlines are
                automatically tagged by category and significance, with human
                review for outlier events.
              </li>
              <li>
                <strong>Data partnerships:</strong> Market and financial data
                is sourced from established providers including Alpha Vantage,
                Financial Modeling Prep, Finnhub, Tiingo, and Marketaux, with
                headline coverage supplemented by NewsAPI and GNews — refreshed
                on documented intervals. See our{' '}
                <Link href="/data-sources">Data Sources</Link> page for the
                full list.
              </li>
            </ul>
            <p>
              Our complete editorial criteria — including how we define a
              &quot;reputable outlet,&quot; how corrections are handled, and
              how independence is maintained — is published at{' '}
              <Link href="/editorial-standards">Editorial Standards</Link>.
            </p>

            <h2>Authoritativeness</h2>
            <p>
              MacroStance currently indexes more than 12,000 articles across
              50+ sources and 9 market categories, making us one of the
              broadest independent aggregators in the retail-accessible
              financial news space. We are actively building relationships
              with data providers and financial media partners; press
              mentions and partnership announcements will be added to this
              page as they are finalized.
            </p>
            <p>
              Press, partnership, and research inquiries are welcomed at{' '}
              <a href="mailto:press@macrostance.com">press@macrostance.com</a>.
            </p>

            <h2>Trust &amp; Transparency</h2>
            <p>
              MacroStance is operated by an independent editorial team. A
              registered business entity will be disclosed here once
              incorporation is finalized. We publish a thorough{' '}
              <Link href="/privacy">Privacy Policy</Link>,{' '}
              <Link href="/terms">Terms of Use</Link>, and{' '}
              <Link href="/disclaimer">Disclaimer</Link>, and disclose any
              affiliate relationships per the disclaimer page.
            </p>
            <p>
              <strong>Corrections policy.</strong> We treat editorial accuracy
              as a baseline obligation. If you believe we have misrepresented
              or improperly attributed any content, write to{' '}
              <a href="mailto:hello@macrostance.com">hello@macrostance.com</a>{' '}
              or use our <Link href="/contact">contact page</Link>. We aim to
              respond within two business days. Corrections are noted directly
              on the affected entry and timestamped.
            </p>
            <p>
              <strong>Data sourcing transparency.</strong> Every article in
              the feed retains a clear link to its original source. We do not
              rewrite, paraphrase, or republish full article bodies — our role
              is to surface and route, not to substitute for the publishers
              whose work we index.
            </p>

            <h2>What We Cover</h2>
            <div className="about-categories">
              {CATEGORIES.map((cat) => (
                <span key={cat} className="about-category-tag">{cat}</span>
              ))}
            </div>

            {/* <h2>Editorial Team</h2>
            <p className="about-team-note">
              The bios below are placeholders pending publication of the full
              team page. Real names, photos, credentials, and links will
              replace these entries.
            </p>
            <div className="about-team-grid">
              {TEAM.map((member) => (
                <div key={member.name} className="about-team-card">
                  <div className="about-team-avatar" aria-hidden="true">◈</div>
                  <div className="about-team-name">{member.name}</div>
                  <div className="about-team-title">{member.title}</div>
                  <p className="about-team-cred">{member.credential}</p>
                </div>
              ))}
            </div> */}

            <div className="about-meta-row">
              <div className="about-meta-item">
                <span className="about-meta-label">Founded</span>
                <span className="about-meta-value">2024</span>
              </div>
              <div className="about-meta-item">
                <span className="about-meta-label">Headquarters</span>
                <span className="about-meta-value">Digital-first, globally distributed</span>
              </div>
              <div className="about-meta-item">
                <span className="about-meta-label">Editorial Standards</span>
                <span className="about-meta-value">
                  <Link href="/editorial-standards">View policy</Link>
                </span>
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
      </main>
    </>
  );
}

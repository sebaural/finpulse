import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { buildMetadata, jsonLd, breadcrumbSchema, canonicalUrl } from '@/lib/seo';
import '../disclaimer/disclaimer.css';

export const metadata: Metadata = buildMetadata({
  title: 'Data Sources — Where MacroStance Headlines and Market Data Come From',
  description:
    'A transparent overview of the categories of sources MacroStance uses for headlines and market data — wire services, financial media, regulators, and central banks.',
  path: '/data-sources',
});

const SECTIONS = [
  {
    title: 'News & Headline Sources',
    body: (
      <>
        <p>
          MacroStance ingests headlines from a curated set of licensed news
          APIs and aggregators, each of which surfaces content from underlying
          publishers and wire services:
        </p>
        <ul>
          <li>
            <strong>Wire-service and global financial newsroom content</strong>{' '}
            — accessed through NewsAPI, GNews, Marketaux, Finnhub, and Tiingo,
            which aggregate reporting from outlets such as Reuters, Bloomberg,
            the Associated Press, and major financial publications.
          </li>
          <li>
            <strong>Business and regional financial media</strong> — including
            CNBC content via the RapidAPI marketplace, and additional regional
            coverage routed through the aggregators listed above.
          </li>
          <li>
            <strong>Macro and equity data feeds</strong> — Alpha Vantage and
            Financial Modeling Prep supply earnings, filings, and
            macroeconomic news flow alongside their market-data endpoints.
          </li>
          <li>
            <strong>Central bank communications:</strong> official statements,
            minutes, and press releases from major central banks, surfaced
            through the aggregators above and direct RSS feeds.
          </li>
          <li>
            <strong>Regulatory filings:</strong> disclosures and announcements
            from financial regulators and exchanges.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Market Data Providers',
    body: (
      <>
        <p>
          Pricing, indices, and ticker data shown across the platform are
          aggregated from third-party market-data APIs — primarily Finnhub,
          Alpha Vantage, Financial Modeling Prep, and Tiingo. Each provider
          publishes its own coverage universe, refresh cadence, and licensing
          terms.
        </p>
        <p>
          Market data shown on MacroStance may be delayed by up to 15 minutes
          per provider terms. The full delay disclosure is on the{' '}
          <Link href="/disclaimer">Disclaimer</Link> page.
        </p>
      </>
    ),
  },
  {
    title: 'Editorial Use of Sources',
    body: (
      <>
        <p>
          MacroStance does not republish full article bodies. Each entry in the
          feed retains a clear link back to the original publisher, and our
          role is to surface and route — not to substitute for the journalism
          we index.
        </p>
        <p>
          For details on how sources qualify for inclusion, see our{' '}
          <Link href="/editorial-standards">Editorial Standards</Link>.
        </p>
      </>
    ),
  },
];

const breadcrumbs = breadcrumbSchema([
  { name: 'Home', url: canonicalUrl('/') },
  { name: 'Data Sources', url: canonicalUrl('/data-sources') },
]);

export default function DataSourcesPage() {
  return (
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <div className="page disclaimer-page">
        <div className="disclaimer-hero" role="note" aria-label="Data sources">
          <div className="disclaimer-hero-inner">
            <span className="disclaimer-hero-icon" aria-hidden="true">◈</span>
            <p className="disclaimer-hero-text">
              We are transparent about where MacroStance content comes from.
              Below is an overview of the source categories powering our feed
              and market data.
            </p>
          </div>
        </div>

        <div className="disclaimer-header">
          <span className="disclaimer-eyebrow">Transparency</span>
          <h1 className="disclaimer-h1">Data Sources</h1>
          <p className="disclaimer-intro">
            The categories of sources we use for headlines, market data, and
            geopolitical intelligence — and how that data is treated before it
            reaches you.
          </p>
        </div>

        <div className="disclaimer-grid">
          {SECTIONS.map(({ title, body }) => (
            <div key={title} className="disclaimer-card">
              <h2>{title}</h2>
              {body}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

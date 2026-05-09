import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { buildMetadata, jsonLd, breadcrumbSchema, canonicalUrl } from '@/lib/seo';
import '../disclaimer/disclaimer.css';

export const metadata: Metadata = buildMetadata({
  title: 'Editorial Standards — How MacroStance Curates Financial News',
  description:
    'MacroStance editorial standards: how we vet sources, filter duplicates, refresh data, handle corrections, and protect editorial independence in financial news.',
  path: '/editorial-standards',
});

const SECTIONS = [
  {
    title: 'Source Selection Criteria',
    body: (
      <>
        <p>
          A source qualifies for inclusion in the MacroStance feed only if it
          meets a baseline of credibility, transparency, and editorial
          accountability. Eligible sources fall into one of four tiers:
        </p>
        <ul>
          <li>
            <strong>Tier 1 — Wire services and primary financial newsrooms</strong>{' '}
            with named editorial leadership and a public corrections policy.
          </li>
          <li>
            <strong>Tier 2 — Established financial publications</strong> with
            consistent market coverage and verifiable editorial bylines.
          </li>
          <li>
            <strong>Tier 3 — Primary issuers</strong>: central banks, financial
            regulators, exchanges, and statistical agencies publishing under
            their official channels.
          </li>
          <li>
            <strong>Tier 4 — Vetted specialist publications</strong> covering
            niche markets (crypto, energy, commodities) with documented
            editorial standards.
          </li>
        </ul>
        <p>
          Press-release wires, content farms, and SEO-driven aggregators are
          not eligible regardless of traffic or domain age.
        </p>
      </>
    ),
  },
  {
    title: 'Content Filtering Methodology',
    body: (
      <>
        <p>
          Every headline ingested into MacroStance passes through a multi-stage
          filtering pipeline before it reaches the public feed:
        </p>
        <ul>
          <li>
            <strong>Duplicate detection.</strong> Near-identical rewrites of
            the same wire story are collapsed into a single entry, with the
            earliest credible publisher retained as the canonical source.
          </li>
          <li>
            <strong>Quality scoring.</strong> Articles are scored on signal
            quality — headlines flagged as clickbait, low-information, or
            promotional are demoted or excluded.
          </li>
          <li>
            <strong>Category classification.</strong> Stories are tagged into
            the appropriate market category (markets, equities, forex,
            commodities, crypto, geopolitics, energy, technology, economy)
            using deterministic rules with human review for edge cases.
          </li>
          <li>
            <strong>Significance flagging.</strong> Outlier events — major
            policy decisions, central bank actions, large-cap corporate
            actions — are surfaced with elevated priority.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Data Freshness Standards',
    body: (
      <>
        <p>
          MacroStance is built around real-time aggregation, but real-time has
          a precise meaning here. Our standards are:
        </p>
        <ul>
          <li>
            Headlines are refreshed at intervals not exceeding 15 minutes for
            primary categories.
          </li>
          <li>
            Market data shown in widgets and tickers may carry delays of up to
            15 minutes per data-provider terms; the delay is disclosed on the{' '}
            <Link href="/disclaimer">Disclaimer</Link> page.
          </li>
          <li>
            Geopolitical briefings on the{' '}
            <Link href="/geopolitics">Geopolitics page</Link> are regenerated
            every 24 hours.
          </li>
          <li>
            Stale or removed source articles are de-listed from the feed
            within one refresh cycle of detection.
          </li>
        </ul>
      </>
    ),
  },
  {
    title: 'Corrections Policy',
    body: (
      <>
        <p>
          Editorial accuracy is a baseline obligation. If you believe a
          MacroStance entry misrepresents, miscategorizes, or improperly
          attributes any content, please report it via our{' '}
          <Link href="/contact">contact page</Link> or by writing directly to{' '}
          <a href="mailto:hello@macrostance.com">hello@macrostance.com</a>.
        </p>
        <p>
          We aim to acknowledge correction requests within two business days
          and resolve confirmed errors within five business days. Corrections
          are noted on the affected entry with a visible timestamp; substantive
          changes to previously published material are flagged as updated
          rather than silently overwritten.
        </p>
      </>
    ),
  },
  {
    title: 'Independence Statement',
    body: (
      <>
        <p>
          MacroStance is editorially independent. We do not accept payment for
          inclusion, prominence, or favorable framing of any source, story, or
          asset class. There is no pay-to-play in the headline feed, no
          sponsored placements disguised as editorial, and no advertiser
          influence over the curation methodology.
        </p>
        <p>
          Affiliate relationships, where they exist, are disclosed in
          accordance with our <Link href="/disclaimer">Disclaimer</Link> and
          do not affect article curation. See{' '}
          <Link href="/data-sources">Data Sources</Link> for the categories of
          providers we work with.
        </p>
      </>
    ),
  },
];

const breadcrumbs = breadcrumbSchema([
  { name: 'Home', url: canonicalUrl('/') },
  { name: 'Editorial Standards', url: canonicalUrl('/editorial-standards') },
]);

export default function EditorialStandardsPage() {
  return (
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <main className="page disclaimer-page">
        <aside className="disclaimer-hero" aria-label="Editorial standards">
          <div className="disclaimer-hero-inner">
            <span className="disclaimer-hero-icon" aria-hidden="true">◈</span>
            <p className="disclaimer-hero-text">
              MacroStance is editorially independent. These standards govern
              how we select sources, filter content, refresh data, and handle
              corrections — and how we keep the feed honest.
            </p>
          </div>
        </aside>

        <div className="disclaimer-header">
          <span className="disclaimer-eyebrow">Editorial</span>
          <h1 className="disclaimer-h1">Editorial Standards</h1>
          <p className="disclaimer-intro">
            Our public commitment to source quality, accuracy, and
            transparency. These policies apply to every headline that reaches
            the MacroStance feed.
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
      </main>
    </>
  );
}

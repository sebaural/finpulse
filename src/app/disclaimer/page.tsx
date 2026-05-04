import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import './disclaimer.css';

export const metadata: Metadata = {
  title: 'Disclaimer — MacroStance',
  description:
    'MacroStance Disclaimer — all content is provided for informational purposes only and does not constitute financial, investment, legal, or tax advice.',
};

const CARDS = [
  {
    title: 'No Investment Advice',
    body: 'Nothing on MacroStance constitutes a recommendation to buy, sell, or hold any security, commodity, currency, or financial instrument. Past performance is not indicative of future results. Always consult a licensed financial professional before making investment decisions.',
  },
  {
    title: 'Accuracy of Information',
    body: 'Content is sourced from third-party news outlets and data providers. MacroStance does not guarantee the accuracy, completeness, or timeliness of any information displayed. We make no warranty that the Platform will be error-free or uninterrupted.',
  },
  {
    title: 'Market Data',
    body: 'Prices, indices, and financial figures shown on this Platform may be delayed by up to 15 minutes or more. This data is provided for informational reference only and should not be used as the basis for any trading or investment decision.',
  },
  {
    title: 'External Links',
    body: 'MacroStance contains links to third-party websites and news sources. We are not responsible for the content, privacy practices, or accuracy of external sites. Accessing linked content is at your own risk.',
  },
  {
    title: 'Affiliate Disclosure',
    body: 'MacroStance may use affiliate links in certain sections of the Platform. These relationships do not influence our editorial content or article curation. We are committed to editorial independence regardless of any commercial relationships.',
  },
];

export default function DisclaimerPage() {
  return (
    <>
      <SiteHeader />
      <div className="page disclaimer-page">
        {/* Hero — breaking-news style callout */}
        <div className="disclaimer-hero" role="note" aria-label="Important disclaimer">
          <div className="disclaimer-hero-inner">
            <span className="disclaimer-hero-icon" aria-hidden="true">⚠</span>
            <p className="disclaimer-hero-text">
              MacroStance is a financial news aggregation platform. All content
              is provided for informational and educational purposes only.
              Nothing on this site constitutes financial, investment, legal, or
              tax advice.
            </p>
          </div>
        </div>

        <div className="disclaimer-header">
          <span className="disclaimer-eyebrow">Legal</span>
          <h1 className="disclaimer-h1">Disclaimer</h1>
          <p className="disclaimer-intro">
            Please review the following important disclaimers regarding the use
            of information provided on MacroStance.
          </p>
        </div>

        <div className="disclaimer-grid">
          {CARDS.map(({ title, body }) => (
            <div key={title} className="disclaimer-card">
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

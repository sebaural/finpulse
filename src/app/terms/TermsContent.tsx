'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';

const SECTIONS = [
  { id: 'acceptance',           title: '1. Acceptance of Terms' },
  { id: 'description',          title: '2. Description of Service' },
  { id: 'intellectual-property',title: '3. Intellectual Property' },
  { id: 'user-conduct',         title: '4. User Conduct' },
  { id: 'disclaimer-advice',    title: '5. Financial Disclaimer' },
  { id: 'liability',            title: '6. Limitation of Liability' },
  { id: 'third-party',          title: '7. Third-Party Links' },
  { id: 'modifications',        title: '8. Modifications to Terms' },
  { id: 'governing-law',        title: '9. Governing Law' },
  { id: 'contact-us',           title: '10. Contact' },
];

function TableOfContents({
  activeId,
  onLinkClick,
}: {
  activeId: string;
  onLinkClick?: () => void;
}) {
  return (
    <>
      {SECTIONS.map(({ id, title }) => (
        <a
          key={id}
          href={`#${id}`}
          className={`legal-toc-link${activeId === id ? ' active' : ''}`}
          onClick={onLinkClick}
        >
          {title}
        </a>
      ))}
    </>
  );
}

export default function TermsContent() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const [tocOpen, setTocOpen] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { rootMargin: '-10% 0px -80% 0px', threshold: 0 },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <SiteHeader />
      <div className="page legal-page">
      <div className="legal-header">
        <span className="legal-eyebrow">Legal</span>
        <h1 className="legal-h1">Terms of Use</h1>
        <p className="legal-updated">Last Updated: January 1, 2026</p>
        <p className="legal-intro">
          Please read these terms carefully before using MacroStance. By
          accessing or using the platform, you agree to be bound by these
          Terms of Use.
        </p>
      </div>

      {/* Full-width financial disclaimer callout above the two-column layout */}
      <div className="terms-disclaimer-callout" role="note">
        <span className="terms-callout-icon" aria-hidden="true">⚠</span>
        <div>
          <strong>Financial Advice Disclaimer</strong>
          <p>
            Content on MacroStance is for informational purposes only and does
            not constitute financial, investment, or trading advice. Always
            consult a qualified financial professional before making investment
            decisions.
          </p>
        </div>
      </div>

      <div className="legal-body">
        {/* Mobile accordion TOC */}
        <div className="legal-toc-mobile">
          <button
            className="legal-toc-toggle"
            onClick={() => setTocOpen((o) => !o)}
            aria-expanded={tocOpen}
          >
            <span>Table of Contents</span>
            <span className="legal-toc-chevron" aria-hidden="true">
              {tocOpen ? '▲' : '▼'}
            </span>
          </button>
          {tocOpen && (
            <nav className="legal-toc-dropdown" aria-label="Page sections">
              <TableOfContents
                activeId={activeId}
                onLinkClick={() => setTocOpen(false)}
              />
            </nav>
          )}
        </div>

        <article className="legal-content">
          <section id="acceptance" className="legal-section">
            <h2>
              <span className="terms-sec-num">01.</span>
              Acceptance of Terms
            </h2>
            <p>
              By accessing or using MacroStance (the &quot;Platform&quot;), you
              agree to be bound by these Terms of Use. If you do not agree to
              these terms, please do not use the Platform. These terms apply to
              all visitors, users, and others who access or use the service.
            </p>
          </section>

          <section id="description" className="legal-section">
            <h2>
              <span className="terms-sec-num">02.</span>
              Description of Service
            </h2>
            <p>
              MacroStance is a financial news aggregation platform that compiles
              publicly available news headlines, market data, and financial
              commentary from third-party sources. The Platform is designed to
              help users stay informed about financial markets and global
              economic events.
            </p>
            <p>
              MacroStance is a news aggregator only. We do not provide financial
              advice, manage investments, or act as a financial advisor, broker,
              or dealer of any kind.
            </p>
          </section>

          <section id="intellectual-property" className="legal-section">
            <h2>
              <span className="terms-sec-num">03.</span>
              Intellectual Property
            </h2>
            <p>
              The MacroStance platform design, logo, interface, and original
              written content are the intellectual property of MacroStance and
              are protected by applicable copyright, trademark, and other
              intellectual property laws. Third-party news content displayed on
              the Platform remains the property of its respective publishers.
            </p>
            <p>
              You may not reproduce, distribute, modify, or create derivative
              works of MacroStance content without explicit written permission.
            </p>
          </section>

          <section id="user-conduct" className="legal-section">
            <h2>
              <span className="terms-sec-num">04.</span>
              User Conduct
            </h2>
            <p>You agree not to use the Platform to:</p>
            <ul>
              <li>
                Scrape, crawl, or programmatically harvest content without
                written permission
              </li>
              <li>
                Attempt to gain unauthorized access to any part of the Platform
                or its infrastructure
              </li>
              <li>
                Transmit any malicious code, viruses, or disruptive data
              </li>
              <li>
                Use the Platform for any unlawful purpose or in violation of
                applicable regulations
              </li>
              <li>
                Circumvent, disable, or otherwise interfere with
                security-related features
              </li>
            </ul>
          </section>

          <section
            id="disclaimer-advice"
            className="legal-section terms-highlighted-section"
          >
            <h2>
              <span className="terms-sec-num">05.</span>
              Disclaimer of Financial Advice
            </h2>
            <p className="terms-key-statement">
              Content on MacroStance is for informational and educational
              purposes only and does not constitute financial, investment,
              legal, or trading advice.
            </p>
            <p>
              Nothing on this Platform should be interpreted as a
              recommendation to buy, sell, or hold any security, commodity,
              currency, or financial instrument. Past performance is not
              indicative of future results. Market data, prices, and financial
              figures displayed may be delayed and should not be relied upon for
              trading or investment decisions.
            </p>
            <p>
              MacroStance expressly disclaims all liability for any financial
              losses or damages arising directly or indirectly from reliance on
              information presented on the Platform. Users are strongly
              encouraged to consult a licensed financial advisor before making
              any investment decisions.
            </p>
          </section>

          <section id="liability" className="legal-section">
            <h2>
              <span className="terms-sec-num">06.</span>
              Limitation of Liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, MacroStance
              and its operators shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages —
              including but not limited to loss of profits, data, or goodwill —
              arising from your use of or inability to use the Platform.
            </p>
            <p>
              The Platform is provided on an &quot;as is&quot; and &quot;as
              available&quot; basis without warranties of any kind, either
              express or implied, including but not limited to warranties of
              merchantability, fitness for a particular purpose, or
              non-infringement.
            </p>
          </section>

          <section id="third-party" className="legal-section">
            <h2>
              <span className="terms-sec-num">07.</span>
              Third-Party Links
            </h2>
            <p>
              The Platform may contain links to third-party websites and news
              sources. These links are provided for convenience only.
              MacroStance has no control over the content of those sites and
              accepts no responsibility for them or for any loss or damage that
              may arise from your use of them. Visiting linked sites is at your
              own risk.
            </p>
          </section>

          <section id="modifications" className="legal-section">
            <h2>
              <span className="terms-sec-num">08.</span>
              Modifications to Terms
            </h2>
            <p>
              MacroStance reserves the right to modify these Terms of Use at
              any time. Changes will be effective immediately upon posting to
              the Platform. The &quot;Last Updated&quot; date at the top of
              this page will reflect the date of the most recent changes. Your
              continued use of the Platform following any changes constitutes
              acceptance of the updated terms.
            </p>
          </section>

          <section id="governing-law" className="legal-section">
            <h2>
              <span className="terms-sec-num">09.</span>
              Governing Law
            </h2>
            <p>
              These Terms of Use shall be governed by and construed in
              accordance with the laws applicable in the jurisdiction of
              MacroStance&apos;s principal place of business, without regard to
              its conflict of law provisions. Any disputes arising under these
              terms shall be subject to the exclusive jurisdiction of the courts
              in that jurisdiction.
            </p>
          </section>

          <section id="contact-us" className="legal-section">
            <h2>
              <span className="terms-sec-num">10.</span>
              Contact
            </h2>
            <p>
              Questions about these Terms of Use should be directed to our team
              via the{' '}
              <Link href="/contact" className="legal-link">
                Contact Us
              </Link>{' '}
              page or by emailing{' '}
              <a href="mailto:hello@macrostance.com" className="legal-link">
                hello@macrostance.com
              </a>
              .
            </p>
          </section>
        </article>
      </div>
    </div>
    </>
  );
}

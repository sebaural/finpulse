'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';

const SECTIONS = [
  { id: 'information-we-collect', title: 'Information We Collect' },
  { id: 'how-we-use',             title: 'How We Use Your Information' },
  { id: 'data-sharing',           title: 'Data Sharing & Third Parties' },
  { id: 'cookies',                title: 'Cookies & Tracking' },
  { id: 'data-retention',         title: 'Data Retention' },
  { id: 'your-rights',            title: 'Your Rights' },
  { id: 'security',               title: 'Security' },
  { id: 'childrens-privacy',      title: "Children's Privacy" },
  { id: 'changes',                title: 'Changes to This Policy' },
  { id: 'contact-us',             title: 'Contact Us' },
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

export default function PrivacyContent() {
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
        <h1 className="legal-h1">Privacy Policy</h1>
        <p className="legal-updated">Last Updated: January 1, 2026</p>
        <p className="legal-intro">
          This Privacy Policy describes how MacroStance collects, uses, and
          handles information when you use our platform.
        </p>
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
          <section id="information-we-collect" className="legal-section">
            <h2>Information We Collect</h2>
            <p>
              MacroStance collects limited information to operate and improve
              the service. This may include:
            </p>
            <ul>
              <li>
                <strong>Usage data</strong> — pages visited, articles read,
                time spent on the platform, click interactions, and referring
                URLs.
              </li>
              <li>
                <strong>Device &amp; technical data</strong> — browser type,
                operating system, IP address (anonymized), screen resolution,
                and language preferences.
              </li>
              <li>
                <strong>Cookies &amp; local storage</strong> — session
                identifiers, preference settings, and analytics tokens.
              </li>
              <li>
                <strong>Newsletter sign-ups</strong> — if you subscribe to
                updates, we collect your email address only.
              </li>
            </ul>
            <p>
              We do not require account creation, and we do not collect names,
              payment information, or government-issued identification.
            </p>
          </section>

          <section id="how-we-use" className="legal-section">
            <h2>How We Use Your Information</h2>
            <p>
              Information collected is used solely to operate and improve
              MacroStance:
            </p>
            <ul>
              <li>
                Deliver and render the platform reliably across devices and
                regions
              </li>
              <li>
                Understand how features are used and identify areas for
                improvement
              </li>
              <li>
                Personalize your feed ordering and content relevance signals
              </li>
              <li>
                Detect and prevent abuse, spam, or automated scraping
              </li>
              <li>
                Send editorial newsletters, if you have opted in
              </li>
            </ul>
            <p>
              We do not use your data to build advertising profiles or target
              you with third-party advertisements.
            </p>
          </section>

          <section id="data-sharing" className="legal-section">
            <h2>Data Sharing &amp; Third Parties</h2>
            <p>
              MacroStance does not sell, rent, or trade personal data. We may
              share anonymized, aggregated usage statistics with service
              providers who help us operate the platform, including analytics
              vendors and infrastructure providers. These vendors are
              contractually bound to process data only as instructed.
            </p>
            <p>
              We may disclose data if required by law, court order, or to
              protect the rights and safety of MacroStance, its users, or the
              public.
            </p>
          </section>

          <section id="cookies" className="legal-section">
            <h2>Cookies &amp; Tracking Technologies</h2>
            <p>
              We use a minimal set of cookies and browser storage mechanisms:
            </p>
            <ul>
              <li>
                <strong>Essential cookies</strong> — required for core
                functionality such as session continuity and preference
                storage.
              </li>
              <li>
                <strong>Analytics cookies</strong> — anonymized usage tracking
                to understand aggregate behavior patterns. We use a
                privacy-respecting analytics tool that does not fingerprint
                users or share data with advertising networks.
              </li>
            </ul>
            <p>
              You may disable cookies via your browser settings. Essential
              cookies cannot be turned off without affecting platform
              functionality.
            </p>
          </section>

          <section id="data-retention" className="legal-section">
            <h2>Data Retention</h2>
            <p>
              Usage logs are retained for up to 90 days for debugging and
              analytics purposes, then automatically purged. Anonymized
              aggregate statistics may be retained indefinitely. If you
              subscribed to our newsletter, your email is retained until you
              unsubscribe, at which point it is deleted within 30 days.
            </p>
          </section>

          <section id="your-rights" className="legal-section">
            <h2>Your Rights</h2>
            <p>
              Depending on your jurisdiction, you may have the right to:
            </p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>
                Object to or restrict certain processing activities
              </li>
              <li>
                Opt out of newsletter communications at any time
              </li>
            </ul>
            <p>
              To exercise any of these rights, please{' '}
              <Link href="/contact" className="legal-link">
                contact us
              </Link>
              . We will respond within 30 days.
            </p>
          </section>

          <section id="security" className="legal-section">
            <h2>Security</h2>
            <p>
              MacroStance uses industry-standard technical and organizational
              measures to protect data against unauthorized access, alteration,
              or destruction. All data in transit is encrypted via TLS. We
              conduct periodic reviews of our security practices and promptly
              address identified vulnerabilities.
            </p>
          </section>

          <section id="childrens-privacy" className="legal-section">
            <h2>Children&apos;s Privacy</h2>
            <p>
              MacroStance is not directed at children under the age of 13 and
              does not knowingly collect personal data from children. If you
              believe we have inadvertently collected data from a child, please{' '}
              <Link href="/contact" className="legal-link">
                contact us
              </Link>{' '}
              immediately.
            </p>
          </section>

          <section id="changes" className="legal-section">
            <h2>Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically to reflect changes
              in our practices or applicable law. When we make material
              changes, we will update the &quot;Last Updated&quot; date at the
              top of this page. Continued use of MacroStance after changes are
              posted constitutes your acceptance of the updated policy.
            </p>
          </section>

          <section id="contact-us" className="legal-section">
            <h2>Contact Us</h2>
            <p>
              Questions about this Privacy Policy or your personal data? Reach
              out via the{' '}
              <Link href="/contact" className="legal-link">
                Contact Us
              </Link>{' '}
              page or email us at{' '}
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

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import NavMenu from '@/components/topNav/NavMenu';
import MacroPageClient from '@/components/macro/MacroPageClient';
import { fetchTopicAnalysis } from '@/lib/topics-service';
import { getLatestMacroResponse } from '@/lib/macro-service';
import { buildMetadata, jsonLd, breadcrumbSchema, canonicalUrl } from '@/lib/seo';
import './deep-dive-analysis.css';

export const metadata: Metadata = buildMetadata({
  title: 'Deep-Dive Analysis',
  description:
    'Deep-Dive Analysis dissects defining geopolitical, macroeconomic, technology, and policy issues through their historical roots and the competing incentives of key players.',
  path: '/deep-dive-analysis',
  ogTitle: 'Deep-Dive Analysis — MacroStance',
  ogDescription:
    'Structural forces behind the headlines — historical roots, key players, and competing incentives, one issue at a time.',
});

export const revalidate = 30;

const breadcrumbs = breadcrumbSchema([
  { name: 'Home', url: canonicalUrl('/') },
  { name: 'Deep-Dive Analysis', url: canonicalUrl('/deep-dive-analysis') },
]);

export default async function Page() {
  const [{ topicAnalysis }, macroInitial] = await Promise.all([
    fetchTopicAnalysis(),
    getLatestMacroResponse(),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <header>
        <div className="header-inner">
          <Link href="/" className="logo" style={{ textDecoration: 'none' }}>
            <Image src="/macrostance-logo.png" alt="MacroStance mark" className="logo-mark" width={40} height={40} priority />
            <h1>MacroStance</h1>
          </Link>
          <NavMenu />
        </div>
      </header>

      <main className="page deep-dive-page">
        <div className="deep-dive-layout">
          <div className="deep-dive-main">
            <section className="deep-dive-hero">
              <h1 className="deep-dive-title">Deep-Dive Analysis</h1>
              <p className="deep-dive-hero-desc">
                Latest deep dives in geopolitics, markets, and tech, sorted
                by date. Each entry breaks down the history, incentives, and
                broader trends driving today&apos;s defining issues.
              </p>
            </section>

            {topicAnalysis.length > 0 ? (
              <div className="deep-dive-list">
                {topicAnalysis.map((item) => (
                  <Link
                    key={item.id}
                    className="deep-dive-item"
                    href={`/topics/${item.topic.slug}/${item.slug}`}
                  >
                    <div className="deep-dive-item-source">{item.topic.name}</div>
                    <div className="deep-dive-item-title">{item.title}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="deep-dive-empty">No Deep-Dive briefings yet.</p>
            )}
          </div>

          <aside className="deep-dive-aside">
            <section className="widget macro-landscape-widget">
              <MacroPageClient initial={macroInitial} />
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}

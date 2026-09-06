import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import NavMenu from '@/components/topNav/NavMenu';
import MacroPageClient from '@/components/macro/MacroPageClient';
import { getLatestMacroResponse } from '@/lib/macro-service';
import { fetchTopicAnalysis } from '@/lib/topics-service';
import { buildMetadata, jsonLd, breadcrumbSchema, canonicalUrl } from '@/lib/seo';
import './macro-landscape.css';
import '@/app/deep-dive-analysis/deep-dive-teaser.css';

export const metadata: Metadata = buildMetadata({
  title: 'The Macro Landscape',
  description:
    'The Macro Landscape distills overnight market movements into a single, cohesive narrative — macroeconomic policy, corporate earnings, currency shifts, geopolitical headlines, and sector rotations.',
  path: '/macro-landscape',
  ogTitle: 'The Macro Landscape — MacroStance',
  ogDescription:
    'Overnight market movements distilled into one cohesive daily narrative.',
});

export const revalidate = 30;

const breadcrumbs = breadcrumbSchema([
  { name: 'Home', url: canonicalUrl('/') },
  { name: 'The Macro Landscape', url: canonicalUrl('/macro-landscape') },
]);

export default async function Page() {
  const [macroInitial, { topicAnalysis }] = await Promise.all([
    getLatestMacroResponse(),
    fetchTopicAnalysis(),
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
            <span>MacroStance</span>
          </Link>
          <NavMenu />
        </div>
      </header>

      <main className="page macro-landscape-page">
        <div className="macro-landscape-layout">
          <div className="macro-landscape-main">
            <section className="widget macro-landscape-widget">
              <MacroPageClient initial={macroInitial} eyebrowAs="h1" />
            </section>
          </div>

          <aside className="macro-landscape-aside">
            <section className="deep-dive-hero">
              <Link href="/deep-dive-analysis" className="deep-dive-title-link">
                <h2 className="deep-dive-title">Deep-Dive Analysis</h2>
              </Link>
              <p className="deep-dive-hero-desc">
                Structural forces behind today&apos;s headlines.
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
          </aside>
        </div>
      </main>
    </>
  );
}

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchTopicBySlug } from '@/lib/topics-service';
import NavMenu from '@/components/topNav/NavMenu';
import { SITE_URL } from '@/lib/seo';
import '@/components/geopolitics/geopolitics.css';

// Next.js 16: params is async and must be awaited.
type Props = { params: Promise<{ topicSlug: string }> };

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topicSlug } = await params;
  const topic = await fetchTopicBySlug(topicSlug);
  if (!topic) return {};

  return {
    title: `${topic.name}`,
    description:
      topic.description ??
      `Institutional macro analysis and deep-dive briefings on ${topic.name}.`,
    alternates: { canonical: `${SITE_URL}/topics/${topicSlug}` },
  };
}

export default async function TopicHubPage({ params }: Props) {
  const { topicSlug } = await params;
  const topic = await fetchTopicBySlug(topicSlug);

  if (!topic) {
    notFound();
  }

  // Flatten the three verticals into one recency-sorted list of briefings.
  const briefings = [
    ...topic.geopoliticsArticles,
    ...topic.marketsArticles,
    ...topic.techArticles,
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div className="geo-root">
      {/* Geopolitics-style dark top nav (kept inside geo-root for the theme). */}
      <div
        className="geo-top-nav"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 24px',
          borderBottom: '1px solid #1e2530',
          background: '#111418',
        }}
      >
        <Link
          href="/"
          className="logo"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Image
            src="/macrostance-logo.png"
            alt="MacroStance mark"
            className="logo-mark"
            width={40}
            height={40}
            priority
          />
          <span>MacroStance</span>
        </Link>
        <NavMenu variant="dark" />
      </div>

      <main className="geo-main">
        <article>
          <h1 className="geo-headline">{topic.name}</h1>
          <hr className="geo-rule" />
          {topic.description && <p className="geo-tagline">{topic.description}</p>}

          {briefings.length === 0 ? (
            <p>No briefings published in this topic yet.</p>
          ) : (
            <>
              <h2 className="geo-sources-title">Briefings</h2>
              <div className="geo-sources-grid">
                {briefings.map((b) => (
                  <div key={`${topicSlug}-${b.slug}`} className="geo-source-card">
                    <p className="geo-source-name">{formatDate(b.createdAt)}</p>
                    <Link href={`/topics/${topicSlug}/${b.slug}`} className="geo-source-link">
                      {b.title}
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </article>
      </main>
    </div>
  );
}

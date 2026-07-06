import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchArticleBySlug } from '@/lib/topics-service';
import AuthorBioCard from '@/components/author/AuthorBioCard';
import RelatedBriefings from '@/components/related/RelatedBriefings';
import NavMenu from '@/components/topNav/NavMenu';
import { SITE_URL } from '@/lib/seo';
import '@/components/geopolitics/geopolitics.css';
import './topics.css';

// Next.js 16: params is async and must be awaited.
type Props = { params: Promise<{ topicSlug: string; articleSlug: string }> };

interface SourceArticleLike {
  source?: string;
  url?: string;
  title?: string;
}

function formatFullDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Mirrors GeopoliticsPageClient: split the summary into headed sections so the
// briefing renders with the same typographic structure as the vertical pages.
const ARTICLE_HEADERS = [
  'INTRODUCTION',
  'HISTORICAL CONTEXT',
  'PRIMARY STAKEHOLDERS',
  'ECONOMIC IMPLICATIONS',
  'FUTURE PROJECTIONS',
  'BEST CASE:',
  'BASE CASE:',
  'WORST CASE:',
];

function renderSummary(summary: string): ReactElement[] {
  const clean = summary.replace(/\*\*/g, '');
  return clean.split('\n\n').flatMap((block, bi) => {
    const trimmed = block.trim();
    if (!trimmed) return [];
    const upper = trimmed.toUpperCase();
    const header = ARTICLE_HEADERS.find(
      (h) => upper === h || upper.startsWith(h + ' ') || upper.startsWith(h + '\n'),
    );
    if (header) {
      const rest = trimmed.slice(header.length).replace(/^[\s—-]+/, '').trim();
      if (!rest) return [<h2 key={bi}>{trimmed.slice(0, header.length)}</h2>];
      return [
        <h2 key={`${bi}h`}>{trimmed.slice(0, header.length)}</h2>,
        <p key={`${bi}p`}>{rest}</p>,
      ];
    }
    return [<p key={bi}>{trimmed}</p>];
  });
}

// fetchArticleBySlug is wrapped in React cache() — generateMetadata and the
// page below resolve from a single DB round-trip within the same render.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topicSlug, articleSlug } = await params;
  const article = await fetchArticleBySlug(articleSlug);
  if (!article || !article.data.topic) return {};

  return {
    title: `${article.data.title}`,
    description: `Institutional macro analysis covering structural trends inside ${article.data.topic.name}.`,
    alternates: {
      canonical: `${SITE_URL}/topics/${topicSlug}/${articleSlug}`,
    },
  };
}

export default async function ArticleSpokePage({ params }: Props) {
  const { topicSlug, articleSlug } = await params;
  const article = await fetchArticleBySlug(articleSlug);

  // 404 when the article is missing, has no topic, or the topic slug in the URL
  // doesn't match the article's actual topic (prevents duplicate-content URLs).
  if (!article || !article.data.topic || article.data.topic.slug !== topicSlug) {
    notFound();
  }

  const { data } = article;
  const topic = data.topic!;
  const pageUrl = `${SITE_URL}/topics/${topicSlug}/${articleSlug}`;
  const keyPoints = Array.isArray(data.keyPoints) ? (data.keyPoints as string[]) : [];
  const tags = Array.isArray(data.tags) ? (data.tags as string[]) : [];
  const sourceArticles = Array.isArray(data.sourceArticles)
    ? (data.sourceArticles as SourceArticleLike[])
    : [];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AnalysisNewsArticle',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': pageUrl,
    },
    headline: data.title,
    datePublished: data.createdAt.toISOString(),
    dateModified: data.updatedAt.toISOString(),
    publisher: {
      '@type': 'Organization',
      name: 'MacroStance',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` },
    },
    backstory:
      'This intelligence brief was built via primary sources, data analysis, and cross-border economic monitoring pipelines.',
    about: {
      '@type': 'Thing',
      name: topic.name,
      sameAs: `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.name)}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="geo-root topics-root">
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
          <article className="topcis-article">
            <div className="geo-article-meta">
              <Link href={`/topics/${topicSlug}`} className="geo-region-badge">
                {`See All ${topicSlug} Articles`}
              </Link>
              <span className="geo-article-date">{formatFullDate(data.date)}</span>
            </div>

            <h1 className="geo-headline">{data.title}</h1>
            <hr className="geo-rule" />

            <div className="geo-body">{renderSummary(data.summary)}</div>

            {keyPoints.length > 0 && (
              <section className="geo-takeaways">
                <h2 className="geo-takeaways-title">Key Takeaways</h2>
                {keyPoints.map((point, i) => (
                  <div key={i} className="geo-takeaway-item">
                    <span className="geo-takeaway-arrow" aria-hidden="true">▸</span>
                    <p>{point}</p>
                  </div>
                ))}
              </section>
            )}

            {tags.length > 0 && (
              <div className="geo-tags">
                {tags.map((tag) => (
                  <span key={tag} className="geo-tag">{tag}</span>
                ))}
              </div>
            )}

            {sourceArticles.length > 0 && (
              <section>
                <h2 className="geo-sources-title">Source Articles</h2>
                <div className="geo-sources-grid">
                  {sourceArticles
                    .filter((src) => src.url && !src.url.includes('rt.com'))
                    .map((src, i) => (
                      <div key={i} className="geo-source-card">
                        <p className="geo-source-name">{src.source}</p>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="geo-source-link"
                        >
                          {src.title}
                        </a>
                      </div>
                    ))}
                </div>
              </section>
            )}
          </article>
        </main>
      </div>

      <AuthorBioCard />

      {/* Cross-article internal linking. Rendered OUTSIDE .geo-root so it carries
          its own theme tokens via .related-root (same as the vertical pages). */}
      <RelatedBriefings currentSlug={articleSlug} currentTags={tags} />
    </>
  );
}

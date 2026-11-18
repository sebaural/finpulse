import type { Metadata } from 'next';
import type { ReactElement } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { fetchArticleBySlug } from '@/lib/topics-service';
import { canonicalizeSlug } from '@/lib/summary-pipeline';
import AuthorBioCard from '@/components/author/AuthorBioCard';
import RelatedBriefings from '@/components/related/RelatedBriefings';
import NavMenu from '@/components/topNav/NavMenu';
import { generateArticleMetadata } from '@/lib/metadata';
import {
  SITE_URL,
  breadcrumbSchema,
  canonicalUrl,
  jsonLd,
  newsArticleSchema,
} from '@/lib/seo';
import { truncateDescription } from '@/lib/stripMarkdown';
import './topics-article.css';
import './topics.css';

// Next.js 16: params is async and must be awaited.
type Props = { params: Promise<{ topicSlug: string; articleSlug: string }> };

const SECTION_LABEL = { geopolitics: 'Geopolitics', markets: 'Markets', tech: 'Technology' } as const;

/**
 * The /topics page shows its own storyline copy when the pipeline produced it,
 * so this URL and the legacy /{vertical}/{slug} briefing carry different text.
 * Older rows (no topic copy) fall back to the shared daily copy.
 */
function topicView(data: {
  title: string;
  summary: string;
  keyPoints: unknown;
  topicTitle: string | null;
  topicSummary: string | null;
  topicKeyPoints: unknown;
}) {
  const ownKeyPoints = Array.isArray(data.topicKeyPoints) ? (data.topicKeyPoints as string[]) : [];
  if (data.topicTitle && data.topicSummary && ownKeyPoints.length > 0) {
    return { distinct: true, title: data.topicTitle, summary: data.topicSummary, keyPoints: ownKeyPoints };
  }
  return {
    distinct: false,
    title: data.title,
    summary: data.summary,
    keyPoints: Array.isArray(data.keyPoints) ? (data.keyPoints as string[]) : [],
  };
}

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
  // Storyline (topic copy) sections
  'WHAT CHANGED',
  'HOW WE GOT HERE',
  'SIGNALS TO WATCH',
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
  // Redirect here too: Next resolves metadata before streaming for crawlers,
  // so Googlebot gets a real 308 instead of a soft-404 / meta refresh.
  if (article.data.topic.slug !== topicSlug) {
    permanentRedirect(`/topics/${article.data.topic.slug}/${articleSlug}`);
  }

  const tags = Array.isArray(article.data.tags) ? (article.data.tags as string[]) : [];
  const view = topicView(article.data);

  return generateArticleMetadata({
    section: article.type,
    title: view.title,
    summary: truncateDescription(view.summary, 160),
    slug: articleSlug,
    publishedTime: article.data.createdAt.toISOString(),
    modifiedTime: article.data.updatedAt.toISOString(),
    tags,
    canonicalUrl: canonicalUrl(`/topics/${topicSlug}/${articleSlug}`),
  });
}

export default async function ArticleSpokePage({ params }: Props) {
  const { topicSlug, articleSlug } = await params;
  const article = await fetchArticleBySlug(articleSlug);

  // 404 when the article is missing or has no topic. If the topic slug in the URL
  // doesn't match the article's current topic (it was reassigned), 308 to the
  // canonical URL — avoids duplicate content without soft-404ing old links.
  if (!article || !article.data.topic) {
    notFound();
  }
  if (article.data.topic.slug !== topicSlug) {
    permanentRedirect(`/topics/${article.data.topic.slug}/${articleSlug}`);
  }

  const { data } = article;
  const topic = data.topic!;
  const pageUrl = `${SITE_URL}/topics/${topicSlug}/${articleSlug}`;
  const view = topicView(data);
  const keyPoints = view.keyPoints;
  const tags = Array.isArray(data.tags) ? (data.tags as string[]) : [];
  const sourceArticles = Array.isArray(data.sourceArticles)
    ? (data.sourceArticles as SourceArticleLike[])
    : [];
  const dailyBriefingPath = `/${article.type}/${canonicalizeSlug(data.slug)}`;

  const articleSchema = {
    ...newsArticleSchema({
      title: view.title,
      description: truncateDescription(view.summary, 300),
      url: pageUrl,
      image: [`${SITE_URL}/macrostance_X.png`],
      datePublished: data.createdAt.toISOString(),
      dateModified: data.updatedAt.toISOString(),
      section: SECTION_LABEL[article.type],
      tags,
      backstory: keyPoints[0],
    }),
    ...(view.distinct ? { '@type': 'AnalysisNewsArticle' } : {}),
    // This page uses its own topics-* classes, not the shared .geo-* selectors.
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['.topics-headline', '.topics-body'],
    },
    about: {
      '@type': 'Thing',
      name: topic.name,
      sameAs: `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.name)}`,
    },
  };

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: topic.name, url: canonicalUrl(`/topics/${topicSlug}`) },
    { name: view.title, url: pageUrl },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(articleSchema) }}
      />
      <div className="topics-root">
        {/* Dark top nav (kept inside .topics-root for the theme tokens). */}
        <div
          className="topics-top-nav"
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
              src="/macrostance-logo-512.png"
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

        <main className="topics-main">
          <article className="topics-article">
            <div className="topics-article-meta">
              <Link href={`/topics/${topicSlug}`} className="topics-region-badge">
                {`See All ${topicSlug} Articles`}
              </Link>
              <span className="topics-article-date">{formatFullDate(data.date)}</span>
            </div>

            <h1 className="topics-headline">{view.title}</h1>
            <hr className="topics-rule" />

            <div className="topics-body">{renderSummary(view.summary)}</div>

            {keyPoints.length > 0 && (
              <section className="topics-takeaways">
                <h2 className="topics-takeaways-title">Key Takeaways</h2>
                {keyPoints.map((point, i) => (
                  <div key={i} className="topics-takeaway-item">
                    <span className="topics-takeaway-arrow" aria-hidden="true">▸</span>
                    <p>{point}</p>
                  </div>
                ))}
              </section>
            )}

            {tags.length > 0 && (
              <div className="topics-tags">
                {tags.map((tag) => (
                  <span key={tag} className="topics-tag">{tag}</span>
                ))}
              </div>
            )}

            {view.distinct && (
              <p className="topics-crosslink">
                <Link href={dailyBriefingPath} className="topics-source-link">
                  {`Read the day's ${SECTION_LABEL[article.type]} briefing: ${data.title} →`}
                </Link>
              </p>
            )}

            {!view.distinct && sourceArticles.length > 0 && (
              <section>
                <h2 className="topics-sources-title">Source Articles</h2>
                <div className="topics-sources-grid">
                  {sourceArticles
                    .filter((src) => src.url && !src.url.includes('rt.com'))
                    .map((src, i) => (
                      <div key={i} className="topics-source-card">
                        <p className="topics-source-name">{src.source}</p>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="topics-source-link"
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

      {/* Cross-article internal linking. Rendered OUTSIDE .topics-root so it carries
          its own theme tokens via .related-root (same as the vertical pages). */}
      <RelatedBriefings currentSlug={articleSlug} currentTags={tags} />
    </>
  );
}

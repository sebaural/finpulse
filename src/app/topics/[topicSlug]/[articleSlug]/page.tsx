import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchArticleBySlug } from '@/lib/topics-service';
import RelatedBriefings from '@/components/related/RelatedBriefings';
import { SITE_URL } from '@/lib/seo';

// Next.js 16: params is async and must be awaited.
type Props = { params: Promise<{ topicSlug: string; articleSlug: string }> };

// fetchArticleBySlug is wrapped in React cache() — generateMetadata and the
// page below resolve from a single DB round-trip within the same render.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topicSlug, articleSlug } = await params;
  const article = await fetchArticleBySlug(articleSlug);
  if (!article || !article.data.topic) return {};

  return {
    title: `${article.data.title} | MacroStance Analysis`,
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
      <article className="max-w-4xl mx-auto prose dark:prose-invert py-8">
        <div className="mb-4">
          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded uppercase">
            {topic.name}
          </span>
        </div>
        <h1>{data.title}</h1>

        <div className="whitespace-pre-wrap">{data.summary}</div>

        {keyPoints.length > 0 && (
          <ul>
            {keyPoints.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        )}

        {/* Cross-article internal linking. tags is a JSON column → cast to string[]. */}
        <RelatedBriefings
          currentSlug={articleSlug}
          currentTags={Array.isArray(data.tags) ? (data.tags as string[]) : []}
        />
      </article>
    </>
  );
}

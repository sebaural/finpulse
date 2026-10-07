// src/app/geopolitics/[slug]/page.tsx

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { getSummaryArticles, getSummaryArticleBySlug } from '@/lib/geopolitics-service';
import { fetchArticleBySlug } from '@/lib/topics-service';
import { generateArticleMetadata } from '@/lib/metadata';
import GeopoliticsPageClient from '@/components/geopolitics/GeopoliticsPageClient';
import RelatedBriefings from '@/components/related/RelatedBriefings';
import AuthorBioCard from '@/components/author/AuthorBioCard';
import {
  jsonLd,
  breadcrumbSchema,
  canonicalUrl,
  newsArticleSchema,
  SITE_URL,
} from '@/lib/seo';
import { truncateDescription } from '@/lib/stripMarkdown';
import { canonicalizeSlug } from '@/lib/summary-pipeline';
import '@/components/geopolitics/geopolitics.css';

export const revalidate = 3600;

// The latest 30 feed the client's article switcher. Older articles are looked
// up directly by slug and prepended, so every stored article stays reachable.
const loadArticles = cache(async (slug: string) => {
  const canonicalSlug = canonicalizeSlug(slug);
  const articles = await getSummaryArticles(30);
  const inList = articles.find((a) => canonicalizeSlug(a.slug) === canonicalSlug);
  if (inList) return { articles, article: inList };
  const article = await getSummaryArticleBySlug(slug);
  return article
    ? { articles: [article, ...articles], article }
    : { articles, article: undefined };
});

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { article } = await loadArticles(slug);

  if (!article) {
    return { title: 'Article not found' };
  }

  // Topic-linked articles canonicalize to their /topics/ hub home.
  const linked = await fetchArticleBySlug(article.slug, 'geopolitics');
  const topicSlug = linked?.data.topic?.slug;

  return generateArticleMetadata({
    section: 'geopolitics',
    title: article.title,
    summary: article.summary,
    slug: article.slug,
    publishedTime: article.createdAt.toISOString(),
    tags: article.tags,
    canonicalUrl: topicSlug
      ? canonicalUrl(`/topics/${topicSlug}/${article.slug}`)
      : undefined,
  });
}

export default async function GeopoliticsArticlePage({ params }: Props) {
  const { slug } = await params;
  const { articles, article } = await loadArticles(slug);

  if (!article) {
    notFound();
  }

  // Topic-linked articles point their canonical/JSON-LD URL at the /topics/ hub.
  const linked = await fetchArticleBySlug(article.slug, 'geopolitics');
  const topicSlug = linked?.data.topic?.slug;
  const articleUrl = topicSlug
    ? canonicalUrl(`/topics/${topicSlug}/${article.slug}`)
    : canonicalUrl(`/geopolitics/${article.slug}`);

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'Geopolitics', url: canonicalUrl('/geopolitics') },
    { name: article.title, url: articleUrl },
  ]);

  // Use the same image as defined in generateArticleMetadata
  const articleImage = `${SITE_URL}/macrostance_X.png`;
  const articleSchema = newsArticleSchema({
    title: article.title,
    description: truncateDescription(article.summary, 300),
    url: articleUrl,
    image: [articleImage],
    datePublished: article.createdAt.toISOString(),
    section: 'Geopolitics',
    tags: article.tags,
    backstory: article.keyPoints?.[0],
  });

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
      <GeopoliticsPageClient articles={articles} initialArticleId={article.id} />
      <AuthorBioCard />
      <RelatedBriefings currentSlug={article.slug} currentTags={article.tags} />
    </>
  );
}

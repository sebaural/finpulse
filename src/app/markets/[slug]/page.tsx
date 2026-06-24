// src/app/markets/[slug]/page.tsx

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getMarketsSummaryArticles } from '@/lib/markets-service';
import { generateArticleMetadata } from '@/lib/metadata';
import MarketsPageClient from '@/components/markets/MarketsPageClient';
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

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const canonicalSlug = canonicalizeSlug(slug);
  const articles = await getMarketsSummaryArticles(30);
  const article = articles.find((a) => canonicalizeSlug(a.slug) === canonicalSlug);

  if (!article) {
    return { title: 'Article not found' };
  }

  return generateArticleMetadata({
    section: 'markets',
    title: article.title,
    summary: article.summary,
    slug: article.slug,
    publishedTime: article.createdAt.toISOString(),
    tags: article.tags,
  });
}

export default async function MarketsArticlePage({ params }: Props) {
  const { slug } = await params;
  const canonicalSlug = canonicalizeSlug(slug);
  const articles = await getMarketsSummaryArticles(30);
  const article = articles.find((a) => canonicalizeSlug(a.slug) === canonicalSlug);

  if (!article) {
    notFound();
  }

  const articleUrl = canonicalUrl(`/markets/${article.slug}`);

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'Markets', url: canonicalUrl('/markets') },
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
    section: 'Markets',
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
      <MarketsPageClient articles={articles} initialArticleId={article.id} />
      <AuthorBioCard />
      <RelatedBriefings currentSlug={article.slug} currentTags={article.tags} />
    </>
  );
}

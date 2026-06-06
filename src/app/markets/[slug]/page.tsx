// src/app/markets/[slug]/page.tsx

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getMarketsSummaryArticles } from '@/lib/markets-service';
import { generateArticleMetadata } from '@/lib/metadata';
import MarketsPageClient from '@/components/markets/MarketsPageClient';
import {
  jsonLd,
  breadcrumbSchema,
  canonicalUrl,
  publisherRef,
  websiteRef,
  SITE_URL,
  DEFAULT_OG_IMAGE,
} from '@/lib/seo';
import { truncateDescription } from '@/lib/stripMarkdown';
import '@/components/geopolitics/geopolitics.css';

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const articles = await getMarketsSummaryArticles(30);
  const article = articles.find((a) => a.slug === slug);

  if (!article) {
    return { title: 'Article not found' };
  }

  return generateArticleMetadata({
    section: 'markets',
    title: article.title,
    summary: article.summary,
    slug,
  });
}

export default async function MarketsArticlePage({ params }: Props) {
  const { slug } = await params;
  const articles = await getMarketsSummaryArticles(30);
  const article = articles.find((a) => a.slug === slug);

  if (!article) {
    notFound();
  }

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'Markets', url: canonicalUrl('/markets') },
    { name: article.title, url: canonicalUrl(`/markets/${slug}`) },
  ]);

  const articleUrl = canonicalUrl(`/markets/${slug}`);
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title.slice(0, 110),
    description: truncateDescription(article.summary, 300),
    url: articleUrl,
    image: [DEFAULT_OG_IMAGE],
    datePublished: article.createdAt.toISOString(),
    dateModified: article.createdAt.toISOString(),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
    isPartOf: websiteRef(),
    author: {
      '@type': 'Person',
      name: 'MacroStance Editorial Desk',
      url: `${SITE_URL}/about`,
    },
    publisher: publisherRef(),
    keywords: article.tags.join(', '),
    articleSection: 'Markets',
  };

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
    </>
  );
}

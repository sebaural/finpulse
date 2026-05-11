// src/app/markets/[slug]/page.tsx

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getMarketsSummaryArticles, toSlug } from '@/lib/markets-service';
import MarketsPageClient from '@/components/markets/MarketsPageClient';
import {
  buildMetadata,
  jsonLd,
  breadcrumbSchema,
  canonicalUrl,
  publisherRef,
  websiteRef,
  SITE_URL,
} from '@/lib/seo';
import '@/components/geopolitics/geopolitics.css';

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const articles = await getMarketsSummaryArticles(30);
  const article = articles.find((a) => toSlug(a.title) === slug);

  if (!article) {
    return buildMetadata({
      title: 'Briefing Not Found — MacroStance Markets',
      description: 'This markets briefing could not be found.',
      path: `/markets/${slug}`,
    });
  }

  return buildMetadata({
    title: `${article.title} — MacroStance Markets`,
    description: article.summary.slice(0, 280),
    path: `/markets/${slug}`,
    ogTitle: article.title,
    ogDescription: article.summary.slice(0, 280),
  });
}

export default async function MarketsArticlePage({ params }: Props) {
  const { slug } = await params;
  const articles = await getMarketsSummaryArticles(30);
  const article = articles.find((a) => toSlug(a.title) === slug);

  if (!article) {
    notFound();
  }

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'Markets', url: canonicalUrl('/markets') },
    { name: article.title, url: canonicalUrl(`/markets/${slug}`) },
  ]);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.summary.slice(0, 280),
    datePublished: article.createdAt.toISOString(),
    dateModified: article.createdAt.toISOString(),
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalUrl(`/markets/${slug}`),
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

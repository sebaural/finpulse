// src/app/geopolitics/[slug]/page.tsx

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSummaryArticles, toSlug } from '@/lib/geopolitics-service';
import GeopoliticsPageClient from '@/components/geopolitics/GeopoliticsPageClient';
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
  const articles = await getSummaryArticles(30);
  const article = articles.find((a) => toSlug(a.title) === slug);

  if (!article) {
    return buildMetadata({
      title: 'Briefing Not Found — MacroStance Geopolitics',
      description: 'This geopolitical briefing could not be found.',
      path: `/geopolitics/${slug}`,
    });
  }

  return buildMetadata({
    title: `${article.title} — MacroStance Geopolitics`,
    description: article.summary.slice(0, 280),
    path: `/geopolitics/${slug}`,
    ogTitle: article.title,
    ogDescription: article.summary.slice(0, 280),
  });
}

export default async function GeopoliticsArticlePage({ params }: Props) {
  const { slug } = await params;
  const articles = await getSummaryArticles(30);
  const article = articles.find((a) => toSlug(a.title) === slug);

  if (!article) {
    notFound();
  }

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'Geopolitics', url: canonicalUrl('/geopolitics') },
    { name: article.title, url: canonicalUrl(`/geopolitics/${slug}`) },
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
      '@id': canonicalUrl(`/geopolitics/${slug}`),
    },
    isPartOf: websiteRef(),
    author: {
      '@type': 'Person',
      name: 'MacroStance Editorial Desk',
      url: `${SITE_URL}/about`,
    },
    publisher: publisherRef(),
    keywords: article.tags.join(', '),
    articleSection: 'Geopolitics',
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
      <GeopoliticsPageClient articles={articles} initialArticleId={article.id} />
    </>
  );
}

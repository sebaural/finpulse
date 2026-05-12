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
  DEFAULT_OG_IMAGE,
} from '@/lib/seo';
import { stripMarkdown, truncateDescription } from '@/lib/stripMarkdown';
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

  const cleanSummary = stripMarkdown(article.summary);

  return buildMetadata({
    title: `${article.title} — MacroStance Geopolitics`,
    description: truncateDescription(cleanSummary, 155),
    path: `/geopolitics/${slug}`,
    ogTitle: article.title,
    ogDescription: truncateDescription(cleanSummary, 300),
    twitterTitle: article.title,
    twitterDescription: truncateDescription(cleanSummary, 200),
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

  const articleUrl = canonicalUrl(`/geopolitics/${slug}`);
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

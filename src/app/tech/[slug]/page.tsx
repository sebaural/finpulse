// src/app/tech/[slug]/page.tsx

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTechSummaryArticles } from '@/lib/tech-service';
import { generateArticleMetadata } from '@/lib/metadata';
import TechPageClient from '@/components/tech/TechPageClient';
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
  const articles = await getTechSummaryArticles(30);
  const article = articles.find((a) => a.slug === slug);

  if (!article) {
    return { title: 'Article not found' };
  }

  return generateArticleMetadata({
    section: 'tech',
    title: article.title,
    summary: article.summary,
    slug,
  });
}

export default async function TechArticlePage({ params }: Props) {
  const { slug } = await params;
  const articles = await getTechSummaryArticles(30);
  const article = articles.find((a) => a.slug === slug);

  if (!article) {
    notFound();
  }

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'Tech', url: canonicalUrl('/tech') },
    { name: article.title, url: canonicalUrl(`/tech/${slug}`) },
  ]);

  const articleUrl = canonicalUrl(`/tech/${slug}`);
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
    articleSection: 'Technology',
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
      <TechPageClient articles={articles} initialArticleId={article.id} />
    </>
  );
}

// src/app/tech/[slug]/page.tsx

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getTechSummaryArticles, toSlug } from '@/lib/tech-service';
import TechPageClient from '@/components/tech/TechPageClient';
import {
  buildMetadata,
  jsonLd,
  breadcrumbSchema,
  canonicalUrl,
  SITE_NAME,
  SITE_URL,
  SITE_LOGO,
} from '@/lib/seo';
import '@/components/geopolitics/geopolitics.css';

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const articles = await getTechSummaryArticles(30);
  const article = articles.find((a) => toSlug(a.title) === slug);

  if (!article) {
    return buildMetadata({
      title: 'Briefing Not Found — MacroStance Tech',
      description: 'This tech briefing could not be found.',
      path: `/tech/${slug}`,
    });
  }

  return buildMetadata({
    title: `${article.title} — MacroStance Tech`,
    description: article.summary.slice(0, 280),
    path: `/tech/${slug}`,
    ogTitle: article.title,
    ogDescription: article.summary.slice(0, 280),
  });
}

export default async function TechArticlePage({ params }: Props) {
  const { slug } = await params;
  const articles = await getTechSummaryArticles(30);
  const article = articles.find((a) => toSlug(a.title) === slug);

  if (!article) {
    notFound();
  }

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'Tech', url: canonicalUrl('/tech') },
    { name: article.title, url: canonicalUrl(`/tech/${slug}`) },
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
      '@id': canonicalUrl(`/tech/${slug}`),
    },
    author: {
      '@type': 'Person',
      name: 'MacroStance Editorial Desk',
      url: `${SITE_URL}/about`,
    },
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: SITE_LOGO,
      },
    },
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

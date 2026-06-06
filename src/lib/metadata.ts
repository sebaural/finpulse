import type { Metadata } from 'next';

interface GenerateArticleMetadataParams {
  section: 'markets' | 'geopolitics' | 'tech';
  title: string;
  summary: string;
  slug: string;
}

const SITE_URL = 'https://macrostance.com';
const DEFAULT_IMAGE = `${SITE_URL}/macrostance_X.png`;

export function generateArticleMetadata({
  section,
  title,
  summary,
  slug,
}: GenerateArticleMetadataParams): Metadata {
  const url = `${SITE_URL}/${section}/${slug}`;

  return {
    title,
    description: summary,
    openGraph: {
      title,
      description: summary,
      url,
      images: [{ url: DEFAULT_IMAGE }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: summary,
      images: [DEFAULT_IMAGE],
    },
  };
}
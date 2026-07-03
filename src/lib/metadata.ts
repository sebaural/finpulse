import type { Metadata } from 'next';
import { AUTHOR_SEBASTIAN_SLUG } from '@/lib/seo';

type Section = 'markets' | 'geopolitics' | 'tech' | 'pulse';

interface GenerateArticleMetadataParams {
  section: Section;
  title: string;
  summary: string;
  slug: string;
  publishedTime?: string; // ISO 8601
  modifiedTime?: string; // ISO 8601, defaults to publishedTime
  tags?: string[];
  /**
   * Absolute canonical URL override. Topic-linked articles pass their
   * /topics/[topicSlug]/[slug] URL so crawlers consolidate to the hub home
   * without a hard redirect. Defaults to the legacy /{section}/{slug} URL.
   */
  canonicalUrl?: string;
}

const SITE_URL = 'https://macrostance.com';

// Use a high-quality, consistent image (1200x630 recommended)
const DEFAULT_IMAGE = `${SITE_URL}/macrostance_X.png`;

// Human-readable section label used for og:article:section and the Twitter
// category label. Mirrors the `articleSection` values in the JSON-LD.
const SECTION_LABEL: Record<Section, string> = {
  geopolitics: 'Geopolitics',
  markets: 'Markets',
  tech: 'Technology',
  pulse: 'Pulse',
};

// Rough reading-time estimate (~200 wpm) for the Twitter summary card.
function estimateReadingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function generateArticleMetadata({
  section,
  title,
  summary,
  slug,
  publishedTime,
  modifiedTime,
  tags,
  canonicalUrl,
}: GenerateArticleMetadataParams): Metadata {
  const url = `${SITE_URL}/${section}/${slug}`;
  const canonical = canonicalUrl ?? url;
  const sectionLabel = SECTION_LABEL[section];
  const readingMinutes = estimateReadingMinutes(summary);

  return {
    title,
    description: summary,
    alternates: { canonical },
    openGraph: {
      type: 'article',
      url: canonical,
      siteName: 'MacroStance',
      locale: 'en_US',
      title,
      description: summary,
      // og:article:* namespace — classifies the page as timestamped news.
      publishedTime,
      modifiedTime: modifiedTime ?? publishedTime,
      authors: [`${SITE_URL}/authors/${AUTHOR_SEBASTIAN_SLUG}`],
      section: sectionLabel,
      tags,
      images: [
        {
          url: DEFAULT_IMAGE,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: summary,
      images: [DEFAULT_IMAGE],
    },
    // Twitter label/data cards surface as structured chips in X previews.
    other: {
      'twitter:label1': 'Reading time',
      'twitter:data1': `${readingMinutes} min read`,
      'twitter:label2': 'Category',
      'twitter:data2': sectionLabel,
    },
  };
}

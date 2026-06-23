import type { Metadata } from 'next';

export const SITE_URL = 'https://macrostance.com';
export const SITE_NAME = 'MacroStance';
export const SITE_LOGO = `${SITE_URL}/macrostance-logo.png`;
export const DEFAULT_OG_IMAGE = `${SITE_URL}/macrostance-logo.png`;

export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const AUTHOR_SEBASTIAN_ID = `${SITE_URL}/#sebastian-pereira`;
export const AUTHOR_SEBASTIAN_SLUG = 'sebastian-pereira';

export function authorPageUrl(slug: string): string {
  return canonicalUrl(`/authors/${slug}`);
}

export const publisherRef = () => ({ '@id': ORG_ID });
export const websiteRef = () => ({ '@id': WEBSITE_ID });
export const sebastianPereiraRef = () => ({ '@id': AUTHOR_SEBASTIAN_ID });

export const SITE_DESCRIPTION =
  'MacroStance delivers real-time financial news, market data, and geopolitical intelligence for traders, analysts, and market observers worldwide.';

interface PageMetaInput {
  title: string;
  description: string;
  path: string;
  ogTitle?: string;
  ogDescription?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  noindex?: boolean;
  ogImage?: string;
}

export function buildMetadata({
  title,
  description,
  path,
  ogTitle,
  ogDescription,
  twitterTitle,
  twitterDescription,
  noindex,
  ogImage,
}: PageMetaInput): Metadata {
  const url = canonicalUrl(path);
  const image = ogImage ?? DEFAULT_OG_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: 'website',
      url,
      siteName: SITE_NAME,
      title: ogTitle ?? title,
      description: ogDescription ?? description,
      images: [{ url: image, alt: SITE_NAME }],
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      site: '@macrostance',
      creator: '@macrostance',
      title: twitterTitle ?? ogTitle ?? title,
      description: twitterDescription ?? ogDescription ?? description,
      images: [image],
    },
  };
}

export function canonicalUrl(path: string): string {
  if (!path || path === '/') return `${SITE_URL}/`;
  const trimmed = path.startsWith('/') ? path : `/${path}`;
  const [pathname] = trimmed.split('?');
  return `${SITE_URL}${pathname.replace(/\/+$/, '') || '/'}`;
}

export function newsMediaOrganizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'NewsMediaOrganization',
    '@id': ORG_ID,
    name: SITE_NAME,
    alternateName: 'MacroStance Financial News',
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: SITE_LOGO,
      width: 512,
      height: 512,
    },
    foundingDate: '2024',
    description: SITE_DESCRIPTION,
    sameAs: [
      'https://www.linkedin.com/company/macrostance',
      'https://x.com/macrostance',
      'https://www.crunchbase.com/organization/macrostance',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        email: 'hello@macrostance.com',
        availableLanguage: ['English'],
      },
      {
        '@type': 'ContactPoint',
        contactType: 'press',
        email: 'press@macrostance.com',
        availableLanguage: ['English'],
      },
    ],
    areaServed: {
      '@type': 'Place',
      name: 'Worldwide',
    },
    knowsAbout: [
      'Financial Markets',
      'Macroeconomics',
      'Equities',
      'Foreign Exchange',
      'Commodities',
      'Cryptocurrency',
      'Geopolitics',
      'Energy Markets',
      'Technology Sector',
    ],
    founder: sebastianPereiraRef(),
  };
}

export function webSiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_ID,
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    inLanguage: 'en-US',
    publisher: publisherRef(),
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

interface PersonSchemaInput {
  id?: string;
  name: string;
  url?: string;
  jobTitle?: string;
  description?: string;
  image?: string;
  sameAs?: string[];
  knowsAbout?: string[];
  alumniOf?: string[];
}

export function personSchema(input: PersonSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': input.id,
    name: input.name,
    url: input.url,
    jobTitle: input.jobTitle,
    description: input.description,
    image: input.image,
    sameAs: input.sameAs,
    knowsAbout: input.knowsAbout,
    alumniOf: input.alumniOf,
    worksFor: publisherRef(),
  };
}

export const SEBASTIAN_PEREIRA_LINKEDIN =
  'https://www.linkedin.com/in/sebastian-pereira-0a4a71410/';

export function sebastianPereiraSchema() {
  return personSchema({
    id: AUTHOR_SEBASTIAN_ID,
    name: 'Sebastian Pereira',
    url: authorPageUrl(AUTHOR_SEBASTIAN_SLUG),
    jobTitle: 'Founder & Editor-in-Chief',
    description:
      'Sebastian Pereira is the founder and Editor-in-Chief of MacroStance, an independent financial news platform aggregating real-time headlines and market data from 50+ trusted global sources. He leads editorial standards, source vetting, and signal-quality methodology across MacroStance’s coverage of equities, macroeconomics, commodities, forex, crypto, and geopolitics.',
    sameAs: [SEBASTIAN_PEREIRA_LINKEDIN],
    knowsAbout: [
      'Financial Markets',
      'Macroeconomics',
      'Equities',
      'Foreign Exchange',
      'Commodities',
      'Cryptocurrency',
      'Geopolitics',
      'Financial Journalism',
      'Market Data Analysis',
    ],
  });
}

// ---------------------------------------------------------------------------
// Author registry
// ---------------------------------------------------------------------------

export interface AuthorProfile {
  slug: string;
  personId: string; // schema.org @id of the Person node
  name: string;
  initials: string;
  avatarUrl?: string; // public/ path; falls back to initials when absent
  jobTitle: string;
  /** Short 2–3 sentence bio for the byline card. */
  bio: string;
  profileUrl: string; // canonical /authors/<slug> URL
  linkedInUrl?: string;
}

export const SEBASTIAN_PEREIRA: AuthorProfile = {
  slug: AUTHOR_SEBASTIAN_SLUG,
  personId: AUTHOR_SEBASTIAN_ID,
  name: 'Sebastian Pereira',
  initials: 'SP',
  avatarUrl: '/Sebastian_Pereira.png',
  jobTitle: 'Founder & Editor-in-Chief',
  bio:
    'Sebastian Pereira is the founder and Editor-in-Chief of MacroStance. He leads editorial standards, source vetting, and signal-quality methodology across coverage of equities, macroeconomics, commodities, forex, crypto, and geopolitics.',
  profileUrl: authorPageUrl(AUTHOR_SEBASTIAN_SLUG),
  linkedInUrl: SEBASTIAN_PEREIRA_LINKEDIN,
};

const AUTHORS: Record<string, AuthorProfile> = {
  [SEBASTIAN_PEREIRA.slug]: SEBASTIAN_PEREIRA,
};

export function getAuthorBySlug(slug: string): AuthorProfile | null {
  return AUTHORS[slug] ?? null;
}

/** Reference an author's Person node by @id. */
export function authorRef(author: AuthorProfile) {
  return { '@type': 'Person', '@id': author.personId };
}

/** ProfilePage schema whose mainEntity is the author's Person node. */
export function profilePageSchema(author: AuthorProfile, personNode: object) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ProfilePage',
        '@id': `${author.profileUrl}#profilepage`,
        url: author.profileUrl,
        name: `${author.name} — ${author.jobTitle}, MacroStance`,
        isPartOf: websiteRef(),
        mainEntity: { '@id': author.personId },
      },
      personNode,
    ],
  };
}

// ---------------------------------------------------------------------------
// NewsArticle schema (shared by geopolitics / markets / tech article pages)
// ---------------------------------------------------------------------------

// CSS selectors for the article headline + body, used by the `speakable`
// block so voice assistants / GEO crawlers know which nodes to read aloud.
// These classes live in src/components/geopolitics/geopolitics.css, which all
// three section page-clients import.
export const ARTICLE_SPEAKABLE_SELECTORS = ['.geo-headline', '.geo-body'];

// Lightweight tag → schema.org entity classification for the `about` field.
// Exact (case-insensitive) match only; anything unrecognised stays a `Thing`.
const KNOWN_COUNTRIES = new Set(
  [
    'United States', 'USA', 'US', 'China', 'Russia', 'Ukraine', 'Israel',
    'Iran', 'India', 'Japan', 'Germany', 'France', 'United Kingdom', 'UK',
    'Saudi Arabia', 'North Korea', 'South Korea', 'Taiwan', 'Turkey', 'Egypt',
    'Syria', 'Palestine', 'Italy', 'Spain', 'Canada', 'Mexico', 'Brazil',
    'Australia', 'Pakistan', 'Venezuela', 'Poland', 'Yemen', 'Lebanon',
  ].map((c) => c.toLowerCase()),
);

const KNOWN_ORGANIZATIONS = new Set(
  [
    'Federal Reserve', 'The Fed', 'ECB', 'European Central Bank', 'IMF',
    'World Bank', 'NATO', 'OPEC', 'OPEC+', 'United Nations', 'UN',
    'Bank of Japan', 'BOJ', 'PBOC', "People's Bank of China",
    'Bank of England', 'SWIFT', 'European Union', 'EU', 'WTO', 'BRICS', 'G7',
    'G20',
  ].map((o) => o.toLowerCase()),
);

function tagToEntity(tag: string) {
  const key = tag.trim().toLowerCase();
  let type: 'Country' | 'Organization' | 'Thing' = 'Thing';
  if (KNOWN_COUNTRIES.has(key)) type = 'Country';
  else if (KNOWN_ORGANIZATIONS.has(key)) type = 'Organization';
  return { '@type': type, name: tag };
}

interface NewsArticleSchemaInput {
  title: string;
  description: string;
  url: string;
  image: string | string[];
  datePublished: string; // ISO 8601
  dateModified?: string; // ISO 8601, defaults to datePublished
  section: string; // e.g. "Geopolitics" | "Markets" | "Technology"
  tags: string[];
}

/**
 * Builds the NewsArticle JSON-LD for an individual briefing.
 *
 * SEO/GEO rationale: dual `@type: [NewsArticle, AnalysisNewsArticle]` satisfies
 * Google News parsers while flagging analytical depth to AI/RAG crawlers; the
 * `about` entity array maps tags to typed schema.org entities for knowledge-graph
 * linking; `speakable` enables voice-assistant surfacing.
 */
export function newsArticleSchema(input: NewsArticleSchemaInput) {
  const images = Array.isArray(input.image) ? input.image : [input.image];
  const published = input.datePublished;

  return {
    '@context': 'https://schema.org',
    '@type': ['NewsArticle', 'AnalysisNewsArticle'],
    headline: input.title.slice(0, 110),
    description: input.description,
    url: input.url,
    image: images,
    datePublished: published,
    dateModified: input.dateModified ?? published,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': input.url,
    },
    isPartOf: websiteRef(),
    author: {
      '@type': 'Person',
      '@id': SEBASTIAN_PEREIRA.personId,
      name: SEBASTIAN_PEREIRA.name,
      url: SEBASTIAN_PEREIRA.profileUrl,
    },
    publisher: publisherRef(),
    keywords: input.tags.join(', '),
    about: input.tags.map(tagToEntity),
    articleSection: input.section,
    inLanguage: 'en-US',
    copyrightYear: Number(published.slice(0, 4)),
    copyrightHolder: publisherRef(),
    license: `${SITE_URL}/terms`,
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ARTICLE_SPEAKABLE_SELECTORS,
    },
  };
}

export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

import type { Metadata } from 'next';

export const SITE_URL = 'https://macrostance.com';
export const SITE_NAME = 'MacroStance';
export const SITE_LOGO = `${SITE_URL}/macrostance-logo.png`;
export const DEFAULT_OG_IMAGE = `${SITE_URL}/macrostance-logo.png`;

export const ORG_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;

export const publisherRef = () => ({ '@id': ORG_ID });
export const websiteRef = () => ({ '@id': WEBSITE_ID });

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
  name: string;
  url?: string;
  jobTitle?: string;
  description?: string;
  image?: string;
  sameAs?: string[];
}

export function personSchema(input: PersonSchemaInput) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: input.name,
    url: input.url,
    jobTitle: input.jobTitle,
    description: input.description,
    image: input.image,
    sameAs: input.sameAs,
    worksFor: {
      '@type': 'NewsMediaOrganization',
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

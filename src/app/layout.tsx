import type { Metadata } from 'next';
import { DM_Sans, DM_Serif_Display } from 'next/font/google';
import type { ReactNode } from 'react';
import Footer from '@/components/Footer';
import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_OG_IMAGE,
  jsonLd,
  newsMediaOrganizationSchema,
  webSiteSchema,
} from '@/lib/seo';
import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-dm-sans',
});

const dmSerif = DM_Serif_Display({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-dm-serif',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Real-Time Financial News & Market Headlines | MacroStance',
    template: '%s | MacroStance',
  },
  description:
    'Track live global market headlines, equities, forex, commodities, crypto, and geopolitical signals — curated in real time across 50+ trusted sources.',
  applicationName: SITE_NAME,
  keywords: [
    'financial news',
    'market headlines',
    'live market data',
    'real-time financial news',
    'global market updates',
    'macroeconomic news',
    'equities news',
    'forex news',
    'commodities news',
    'crypto news',
    'geopolitics',
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: SITE_NAME,
    title: 'MacroStance — Real-Time Global Financial News & Market Intelligence',
    description:
      'Independent financial newsroom aggregating high-signal headlines and market data across equities, macro, forex, commodities, crypto, and geopolitics.',
    images: [{ url: DEFAULT_OG_IMAGE, alt: SITE_NAME }],
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@macrostance',
    creator: '@macrostance',
    title: 'MacroStance — Real-Time Global Financial News',
    description:
      'High-signal financial headlines, market data, and geopolitical intelligence — built for traders, analysts, and serious market observers.',
    images: [DEFAULT_OG_IMAGE],
  },
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
  category: 'finance',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&family=Fira+Sans:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Gideon+Roman&family=Inconsolata:wght@200..900&display=swap"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(newsMediaOrganizationSchema()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(webSiteSchema()) }}
        />
      </head>
      <body suppressHydrationWarning className={`${dmSans.variable} ${dmSerif.variable}`}>
        <div className="layout-content">{children}</div>
        <Footer />
      </body>
    </html>
  );
}


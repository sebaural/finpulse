// src/app/macro/[slug]/page.tsx
//
// Permalink for one specific day's entry (used by the sitemap and by direct
// links). Renders the same single-item view as /macro?date=..., resolved by slug.

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import NavMenu from '@/components/topNav/NavMenu';
import MacroPageClient from '@/components/macro/MacroPageClient';
import { buildMacroResponse, getMacroArticleBySlug } from '@/lib/macro-service';
import {
  buildMetadata,
  breadcrumbSchema,
  canonicalUrl,
  jsonLd,
} from '@/lib/seo';

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getMacroArticleBySlug(slug);
  if (!article) return { title: 'The Macro Landscape — entry not found' };

  return buildMetadata({
    title: article.title,
    description: `${article.title} — a daily macroeconomic summary from MacroStance.`,
    path: `/macro/${article.slug}`,
    ogTitle: article.title,
    ogDescription: 'The macro stories moving markets, in one concise daily briefing.',
  });
}

export default async function MacroArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getMacroArticleBySlug(slug);
  if (!article) notFound();

  const initial = await buildMacroResponse(article);

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'The Macro Landscape', url: canonicalUrl('/macro') },
    { name: article.title, url: canonicalUrl(`/macro/${article.slug}`) },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 24px',
          borderBottom: '1px solid #1e2530',
        }}
      >
        <Link
          href="/"
          className="logo"
          style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Image src="/macrostance-logo.png" alt="MacroStance mark" width={40} height={40} priority />
          <span>MacroStance</span>
        </Link>
        <NavMenu variant="dark" />
      </div>
      <main className="macro-page">
        <MacroPageClient initial={initial} variant="page" />
      </main>
    </>
  );
}

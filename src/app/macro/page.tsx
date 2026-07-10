// src/app/macro/page.tsx

import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import NavMenu from '@/components/topNav/NavMenu';
import MacroPageClient from '@/components/macro/MacroPageClient';
import {
  buildMacroResponse,
  getLatestMacroResponse,
  getMacroArticleByDate,
} from '@/lib/macro-service';
import {
  buildMetadata,
  breadcrumbSchema,
  canonicalUrl,
  jsonLd,
} from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'The Macro Landscape — Daily Macroeconomic Summary',
  description:
    'A neutral daily read on the macroeconomic landscape — the stories driving markets, rates, and the growth and inflation outlook. Step back through the archive one day at a time.',
  path: '/macro',
  ogTitle: 'The Macro Landscape — MacroStance',
  ogDescription:
    'The macro stories moving markets today, in one concise daily briefing.',
});

export const revalidate = 3600;

interface Props {
  searchParams: Promise<{ date?: string }>;
}

export default async function MacroPage({ searchParams }: Props) {
  const { date } = await searchParams;

  // `?date=` deep-links a specific day (a single selected date, not a page
  // number); otherwise show the latest entry.
  let initial;
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();
    const article = await getMacroArticleByDate(date);
    if (!article) notFound();
    initial = await buildMacroResponse(article);
  } else {
    initial = await getLatestMacroResponse();
  }

  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'The Macro Landscape', url: canonicalUrl('/macro') },
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

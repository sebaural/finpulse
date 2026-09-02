import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import NavMenu from '@/components/topNav/NavMenu';
import MacroPageClient from '@/components/macro/MacroPageClient';
import { getLatestMacroResponse } from '@/lib/macro-service';
import { buildMetadata, jsonLd, breadcrumbSchema, canonicalUrl } from '@/lib/seo';
import './macro-landscape.css';

export const metadata: Metadata = buildMetadata({
  title: 'The Macro Landscape',
  description:
    'The Macro Landscape distills overnight market movements into a single, cohesive narrative — macroeconomic policy, corporate earnings, currency shifts, geopolitical headlines, and sector rotations.',
  path: '/macro-landscape',
  ogTitle: 'The Macro Landscape — MacroStance',
  ogDescription:
    'Overnight market movements distilled into one cohesive daily narrative.',
});

export const revalidate = 30;

const breadcrumbs = breadcrumbSchema([
  { name: 'Home', url: canonicalUrl('/') },
  { name: 'The Macro Landscape', url: canonicalUrl('/macro-landscape') },
]);

export default async function Page() {
  const macroInitial = await getLatestMacroResponse();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <header>
        <div className="header-inner">
          <Link href="/" className="logo" style={{ textDecoration: 'none' }}>
            <Image src="/macrostance-logo.png" alt="MacroStance mark" className="logo-mark" width={40} height={40} priority />
            <span>MacroStance</span>
          </Link>
          <NavMenu />
        </div>
      </header>

      <main className="page macro-landscape-page">
        <div className="main-content">
          <section className="widget macro-landscape-widget">
            <MacroPageClient initial={macroInitial} eyebrowAs="h1" />
          </section>
        </div>
      </main>
    </>
  );
}

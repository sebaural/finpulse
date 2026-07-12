import type { Metadata } from 'next';
import PageClient from './PageClient';
import { getAggregatedNews } from '@/server/news';
import { getLatestMacroResponse } from '@/lib/macro-service';
import { buildMetadata } from '@/lib/seo';

export const metadata: Metadata = buildMetadata({
  title: 'Live Feed — Real-Time Market & Macro News',
  description:
    'The live newsroom feed — breaking market, economy, and geopolitics stories as they land, alongside the daily Macro Landscape summary.',
  path: '/live-feed',
  ogTitle: 'Live Feed — MacroStance',
  ogDescription:
    'Breaking market and macro news as it lands, with the daily Macro Landscape alongside.',
});

export const revalidate = 30;

export default async function Page() {
  const [{ articles }, macroInitial] = await Promise.all([
    getAggregatedNews(),
    getLatestMacroResponse(),
  ]);

  return <PageClient initialArticles={articles} macroInitial={macroInitial} />;
}

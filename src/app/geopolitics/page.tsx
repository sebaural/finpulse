// src/app/geopolitics/page.tsx

import type { Metadata } from 'next';
import { getSummaryArticles } from '@/lib/geopolitics-service';
import GeopoliticsPageClient from '@/components/geopolitics/GeopoliticsPageClient';
import '@/components/geopolitics/geopolitics.css';

export const metadata: Metadata = {
  title: 'Geopolitics of the Day',
  description:
    'AI-generated daily intelligence briefings synthesizing the top geopolitical developments from around the world.',
};

export const revalidate = 3600;

export default async function GeopoliticsPage() {
  const articles = await getSummaryArticles(30);
  return <GeopoliticsPageClient articles={articles} />;
}

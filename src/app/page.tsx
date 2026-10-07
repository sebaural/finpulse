import type { Metadata } from 'next';
import HomeClient from '@/components/HomePage/HomeClient';
import { getAggregatedNews } from '@/server/news';
import { getLatestArticlePerCategory } from '@/lib/pulse-service';
import { canonicalUrl } from '@/lib/seo';

// Only `alternates` is set here (rather than a full buildMetadata() call) so
// the homepage keeps inheriting its richer title/robots/openGraph/twitter
// defaults from the root layout instead of them being replaced wholesale.
export const metadata: Metadata = {
  alternates: { canonical: canonicalUrl('/') },
};

export const revalidate = 30;

export default async function Page() {
  const [{ articles }, pulseLatest] = await Promise.all([
    getAggregatedNews(),
    getLatestArticlePerCategory(),
  ]);

  return (
    <HomeClient
      initialArticles={articles}
      pulseLatest={pulseLatest}
    />
  );
}

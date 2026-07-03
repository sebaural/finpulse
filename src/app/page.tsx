import HomeClient from '@/components/HomeClient';
import { getAggregatedNews } from '@/server/news';
import { fetchTopicAnalysis } from '@/lib/topics-service';
import { getLatestArticlePerCategory } from '@/lib/pulse-service';

export const revalidate = 30;

export default async function Page() {
  const [{ articles, usingFallback }, { geoAnalysis, marketAnalysis }, pulseLatest] = await Promise.all([
    getAggregatedNews(),
    fetchTopicAnalysis(),
    getLatestArticlePerCategory(),
  ]);

  return (
    <HomeClient
      initialArticles={articles}
      initialUsingFallback={usingFallback}
      geoAnalysis={geoAnalysis}
      marketAnalysis={marketAnalysis}
      pulseLatest={pulseLatest}
    />
  );
}

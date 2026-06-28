import HomeClient from '@/components/HomeClient';
import { getAggregatedNews } from '@/server/news';
import { fetchTopicAnalysis } from '@/lib/topics-service';

export const revalidate = 30;

export default async function Page() {
  const [{ articles, usingFallback }, { geoAnalysis, marketAnalysis }] = await Promise.all([
    getAggregatedNews(),
    fetchTopicAnalysis(),
  ]);

  return (
    <HomeClient
      initialArticles={articles}
      initialUsingFallback={usingFallback}
      geoAnalysis={geoAnalysis}
      marketAnalysis={marketAnalysis}
    />
  );
}

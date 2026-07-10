import HomeClient from '@/components/HomeClient';
import { getAggregatedNews } from '@/server/news';
import { fetchTopicAnalysis } from '@/lib/topics-service';
import { getLatestArticlePerCategory } from '@/lib/pulse-service';
import { getLatestMacroResponse } from '@/lib/macro-service';

export const revalidate = 30;

export default async function Page() {
  const [{ articles, usingFallback }, { topicAnalysis }, pulseLatest, macroInitial] =
    await Promise.all([
      getAggregatedNews(),
      fetchTopicAnalysis(),
      getLatestArticlePerCategory(),
      getLatestMacroResponse(),
    ]);

  return (
    <HomeClient
      initialArticles={articles}
      initialUsingFallback={usingFallback}
      topicAnalysis={topicAnalysis}
      pulseLatest={pulseLatest}
      macroInitial={macroInitial}
    />
  );
}

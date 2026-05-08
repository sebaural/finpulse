import HomeClient from '@/components/HomeClient';
import { getAggregatedNews } from '@/server/news';

export const revalidate = 30;

export default async function Page() {
  const { articles, usingFallback } = await getAggregatedNews();

  return (
    <HomeClient
      initialArticles={articles}
      initialUsingFallback={usingFallback}
    />
  );
}

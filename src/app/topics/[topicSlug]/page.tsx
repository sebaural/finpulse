import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { fetchTopicBySlug } from '@/lib/topics-service';
import { SITE_URL } from '@/lib/seo';

// Next.js 16: params is async and must be awaited.
type Props = { params: Promise<{ topicSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topicSlug } = await params;
  const topic = await fetchTopicBySlug(topicSlug);
  if (!topic) return {};

  return {
    title: `${topic.name} | MacroStance Analysis`,
    description:
      topic.description ??
      `Institutional macro analysis and deep-dive briefings on ${topic.name}.`,
    alternates: { canonical: `${SITE_URL}/topics/${topicSlug}` },
  };
}

export default async function TopicHubPage({ params }: Props) {
  const { topicSlug } = await params;
  const topic = await fetchTopicBySlug(topicSlug);

  if (!topic) {
    notFound();
  }

  // Flatten the three verticals into one recency-sorted list of briefings.
  const briefings = [
    ...topic.geopoliticsArticles,
    ...topic.marketsArticles,
    ...topic.techArticles,
  ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <article className="max-w-4xl mx-auto prose dark:prose-invert py-8">
      <h1>{topic.name}</h1>
      {topic.description && <p>{topic.description}</p>}

      {briefings.length === 0 ? (
        <p>No briefings published in this topic yet.</p>
      ) : (
        <ul>
          {briefings.map((b) => (
            <li key={`${topicSlug}-${b.slug}`}>
              <a href={`/topics/${topicSlug}/${b.slug}`}>{b.title}</a>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

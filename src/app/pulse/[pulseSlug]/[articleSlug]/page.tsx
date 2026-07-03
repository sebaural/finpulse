import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PulseHeader from '@/components/pulse/PulseHeader';
import { resolvePulseSlug } from '@/lib/pulse-categories';
import { getPulseArticleBySlug } from '@/lib/pulse-service';
import { generateArticleMetadata } from '@/lib/metadata';
import { canonicalUrl } from '@/lib/seo';
import '@/components/pulse/pulse.css';

interface ArticlePageProps {
  params: Promise<{ pulseSlug: string; articleSlug: string }>;
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { pulseSlug: rawPulseSlug, articleSlug } = await params;
  const pulseSlug = resolvePulseSlug(rawPulseSlug);
  if (!pulseSlug) return {};

  const article = await getPulseArticleBySlug(pulseSlug, articleSlug);
  if (!article) return {};

  return generateArticleMetadata({
    section: 'pulse',
    title: article.title,
    summary: article.summary ?? article.body ?? article.title,
    slug: `${pulseSlug}/${articleSlug}`,
    publishedTime: article.publishedAt ?? undefined,
    modifiedTime: article.observedEnd ?? article.publishedAt ?? undefined,
    tags: [article.category, pulseSlug],
    canonicalUrl: canonicalUrl(`/pulse/${pulseSlug}/${articleSlug}`),
  });
}

export default async function PulseArticlePage({ params }: ArticlePageProps) {
  const { pulseSlug: rawPulseSlug, articleSlug } = await params;
  const pulseSlug = resolvePulseSlug(rawPulseSlug);
  if (!pulseSlug) notFound();

  const article = await getPulseArticleBySlug(pulseSlug, articleSlug);
  if (!article) notFound();

  return (
    <>
      <PulseHeader />
      <main className="pulse-page pulse-article-page">
        <div className="pulse-container">
          <p className="pulse-crumbs">
            <Link href={`/pulse/${pulseSlug}`}>Pulse / {pulseSlug}</Link>
          </p>
          <h1>{article.title}</h1>
          {article.summary ? <p className="pulse-summary">{article.summary}</p> : null}
          {article.body ? <article className="pulse-body">{article.body}</article> : null}
          {article.sourceUrl ? (
            <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="pulse-source-link">
              View source
            </a>
          ) : null}
        </div>
      </main>
    </>
  );
}

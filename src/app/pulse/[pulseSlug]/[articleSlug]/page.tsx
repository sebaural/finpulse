import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PulseHeader from '@/components/pulse/PulseHeader';
import { PULSE_CATEGORIES, resolvePulseSlug } from '@/lib/pulse-categories';
import { formatPulseDisplayDate, getPulseDisplayDateSource } from '@/lib/pulse-date';
import { isHtmlFragment, sanitizeArticleHtml } from '@/lib/article-html';
import { getPulseArticleBySlug, getLatestArticlePerCategory } from '@/lib/pulse-service';
import { generateArticleMetadata } from '@/lib/metadata';
import { canonicalUrl } from '@/lib/seo';
import { getPulseSchemaMarkup } from '@/types/pulse';
import '@/components/pulse/pulse.css';

import { PulseHighlights } from '@/components/pulse/PulseHighlights';

export const dynamic = 'force-dynamic';

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
  const config = PULSE_CATEGORIES[pulseSlug];

  const article = await getPulseArticleBySlug(pulseSlug, articleSlug);
  if (!article) notFound();
  const breadcrumbDate = formatPulseDisplayDate(getPulseDisplayDateSource(article));
  const schemaMarkup = getPulseSchemaMarkup(article);
  const pulseLatest = await getLatestArticlePerCategory();

  return (
    <>
      <PulseHeader />
      <main className="pulse-page pulse-article-page">

          <div className="pulse-article-toolbar">
            <Link href={`/pulse/${pulseSlug}`} className="pulse-back-button">
              ← View All {config.label} Articles
            </Link>
          </div>

        <div className="pulse-container">

        <div className="pulse-article-proper">

         
          <p className="pulse-crumbs">
            <Link href={`/pulse/${pulseSlug}`}>Pulse / {pulseSlug}</Link>
            {breadcrumbDate ? (
              <>
                <span className="pulse-crumb-sep" aria-hidden="true">
                  {' / '}
                </span>
                <span className="pulse-crumb-date">{breadcrumbDate}</span>
              </>
            ) : null}
          </p>
          <h1>{article.title}</h1>
          {article.summary ? <p className="pulse-summary">{article.summary}</p> : null}
          {article.body && isHtmlFragment(article.body) ? (
            <article
              className="pulse-body pulse-body--html"
              dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(article.body) }}
            />
          ) : article.body ? (
            <article className="pulse-body">{article.body}</article>
          ) : null}
          {article.sourceUrl ? (
            <a href={article.sourceUrl} target="_blank" rel="noopener noreferrer" className="pulse-source-link">
              View source
            </a>
          ) : null}
          {schemaMarkup ? (
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup).replace(/</g, '\\u003c') }}
            />
          ) : null}
        </div>

      
        <div className="pulse-article-sidebar-content">
            <PulseHighlights latestByCategory={pulseLatest} />
        </div>


        </div>

      </main>
    </>
  );
}

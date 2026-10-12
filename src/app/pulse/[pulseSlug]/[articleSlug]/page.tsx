import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import PulseHeader from '@/components/pulse/PulseHeader';
import { PULSE_CATEGORIES, resolvePulseSlug } from '@/lib/pulse-categories';
import { formatPulseDisplayDate, getPulseDisplayDateSource } from '@/lib/pulse-date';
import { isHtmlFragment, sanitizeArticleHtml } from '@/lib/article-html';
import {
  findPulseArticleByArticleSlug,
  getPulseArticleBySlug,
  getLatestArticlePerCategory,
} from '@/lib/pulse-service';
import { generateArticleMetadata } from '@/lib/metadata';
import { breadcrumbSchema, canonicalUrl, jsonLd } from '@/lib/seo';
import { getPulseSchemaMarkup } from '@/types/pulse';
import '@/components/pulse/pulse.css';

import { PulseHighlights } from '@/components/pulse/PulseHighlights';

export const dynamic = 'force-dynamic';

interface ArticlePageProps {
  params: Promise<{ pulseSlug: string; articleSlug: string }>;
}

// Articles that moved category (e.g. information→technology rename) 308 to their
// current URL instead of soft-404ing (200 + Next's auto "noindex"). Called from
// generateMetadata too, which Next resolves before streaming for crawlers, so
// Googlebot gets a real redirect status rather than a meta refresh.
async function redirectIfMoved(rawPulseSlug: string, articleSlug: string): Promise<void> {
  const moved = await findPulseArticleByArticleSlug(articleSlug);
  if (moved && moved.pulseSlug !== resolvePulseSlug(rawPulseSlug)) {
    permanentRedirect(`/pulse/${moved.pulseSlug}/${articleSlug}`);
  }
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { pulseSlug: rawPulseSlug, articleSlug } = await params;
  const pulseSlug = resolvePulseSlug(rawPulseSlug);
  const article = pulseSlug ? await getPulseArticleBySlug(pulseSlug, articleSlug) : null;
  if (!pulseSlug || !article) {
    await redirectIfMoved(rawPulseSlug, articleSlug);
    return {};
  }

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
  const article = pulseSlug ? await getPulseArticleBySlug(pulseSlug, articleSlug) : null;
  if (!pulseSlug || !article) {
    await redirectIfMoved(rawPulseSlug, articleSlug);
    notFound();
  }
  const config = PULSE_CATEGORIES[pulseSlug];
  const breadcrumbDate = formatPulseDisplayDate(getPulseDisplayDateSource(article));
  const schemaMarkup = getPulseSchemaMarkup(article);
  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: `${config.label} Pulse`, url: canonicalUrl(`/pulse/${pulseSlug}`) },
    { name: article.title, url: canonicalUrl(`/pulse/${pulseSlug}/${articleSlug}`) },
  ]);
  const pulseLatest = await getLatestArticlePerCategory();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
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

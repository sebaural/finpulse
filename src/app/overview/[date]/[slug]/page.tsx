import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getPrisma } from '@/lib/db';
import { generateArticleMetadata } from '@/lib/metadata';
import {
  jsonLd,
  breadcrumbSchema,
  canonicalUrl,
  newsArticleSchema,
  formatDateSegment,
  SITE_URL,
} from '@/lib/seo';
import { isHtmlFragment, sanitizeArticleHtml } from '@/lib/article-html';

export const revalidate = 3600;

interface Props {
  params: Promise<{ date: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const prisma = getPrisma();
  const article = await prisma.overviewArticle.findUnique({ where: { slug } });

  if (!article) {
    return { title: 'Article not found' };
  }

  return generateArticleMetadata({
    section: 'overview',
    title: article.title,
    summary: article.summary,
    slug: article.slug,
    publishedTime: article.publishedDate.toISOString(),
    tags: [article.category],
    canonicalUrl: canonicalUrl(
      `/overview/${formatDateSegment(article.publishedDate)}/${article.slug}`
    ),
  });
}

export default async function Page({ params }: Props) {
  const { date, slug } = await params;
  const prisma = getPrisma();

  const article = await prisma.overviewArticle.findUnique({
    where: { slug },
  });

  if (!article) {
    // Next.js convention: notFound() renders the nearest not-found.tsx
    // (src/app/not-found.tsx already exists in this project) and returns a
    // real 404 status — silently rendering nothing here would instead give
    // visitors and crawlers an empty 200 page, which is worse for both UX
    // and SEO than a proper 404.
    notFound();
  }

  // slug is the sole unique key (see overview-service.ts for why); the date
  // segment is derived from publishedDate, not looked up independently. If
  // the URL's date segment doesn't match the article's actual publish date,
  // redirect to the canonical URL rather than silently serving the same
  // article under two different-looking dates (duplicate-content risk).
  const canonicalDate = formatDateSegment(article.publishedDate);
  if (canonicalDate !== date) {
    redirect(`/overview/${canonicalDate}/${slug}`);
  }

  const displayDate = new Date(article.publishedDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const articleUrl = canonicalUrl(`/overview/${canonicalDate}/${slug}`);
  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: 'Overview', url: canonicalUrl('/overview') },
    { name: article.title, url: articleUrl },
  ]);
  const articleImage = `${SITE_URL}/macrostance_X.png`;
  const articleSchema = newsArticleSchema({
    title: article.title,
    description: article.summary,
    url: articleUrl,
    image: [articleImage],
    datePublished: article.publishedDate.toISOString(),
    section: 'Overview',
    tags: [article.category],
  });

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(articleSchema) }}
      />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <article className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b border-neutral-200 px-6 py-5 sm:px-8">
            <div className="flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-neutral-500">
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-neutral-700">
                {article.category}
              </span>
              <time dateTime={new Date(article.publishedDate).toISOString()}>
                {displayDate}
              </time>
            </div>

            <h1 className="mt-3 text-2xl font-bold leading-tight text-neutral-900 sm:text-3xl">
              {article.title}
            </h1>

            <p className="mt-3 text-base leading-relaxed text-neutral-600">
              {article.summary}
            </p>
          </div>

          {/* article.body is LLM-generated from third-party RSS source text
             (see overview-service.ts) — sanitized here the same way Pulse and
             Macro Landscape sanitize their LLM-generated bodies, since the
             RSS snippets feeding the prompt aren't trusted input.

             Styling is hand-written via Tailwind's arbitrary child-selector
             syntax rather than the @tailwindcss/typography plugin's `prose`
             classes, so this doesn't depend on that plugin being installed.
             Targets exactly the two elements the system prompt guarantees
             the model will produce: one <h2> per subsection heading, one
             <p> per subsection body. */}
          {article.body && isHtmlFragment(article.body) ? (
            <div
              className="px-6 py-6 sm:px-8 [&>h2]:mt-6 [&>h2]:mb-2 [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:text-neutral-900 [&>h2:first-child]:mt-0 [&>p]:mb-4 [&>p]:leading-relaxed [&>p]:text-neutral-700 [&>p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: sanitizeArticleHtml(article.body) }}
            />
          ) : article.body ? (
            <div className="px-6 py-6 text-base leading-relaxed text-neutral-700 sm:px-8">
              {article.body}
            </div>
          ) : null}
        </article>
      </main>
    </>
  );
}

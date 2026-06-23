// src/app/authors/[slug]/page.tsx

import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { getSummaryArticles } from '@/lib/geopolitics-service';
import { getMarketsSummaryArticles } from '@/lib/markets-service';
import { getTechSummaryArticles } from '@/lib/tech-service';
import { truncateDescription } from '@/lib/stripMarkdown';
import {
  buildMetadata,
  jsonLd,
  breadcrumbSchema,
  canonicalUrl,
  getAuthorBySlug,
  profilePageSchema,
  sebastianPereiraSchema,
  AUTHOR_SEBASTIAN_SLUG,
} from '@/lib/seo';
import './authors.css';

export const revalidate = 3600;

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return [{ slug: AUTHOR_SEBASTIAN_SLUG }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const author = getAuthorBySlug(slug);
  if (!author) return { title: 'Author not found' };

  return buildMetadata({
    title: `${author.name} — ${author.jobTitle}`,
    description: author.bio,
    path: `/authors/${author.slug}`,
  });
}

type ArchiveSection = 'geopolitics' | 'markets' | 'tech';
const SECTION_LABEL: Record<ArchiveSection, string> = {
  geopolitics: 'Geopolitics',
  markets: 'Markets',
  tech: 'Technology',
};

interface ArchiveItem {
  section: ArchiveSection;
  slug: string;
  title: string;
  excerpt: string;
  date: string;
}

async function getAuthorArchive(): Promise<ArchiveItem[]> {
  const [geo, markets, tech] = await Promise.all([
    getSummaryArticles(8),
    getMarketsSummaryArticles(8),
    getTechSummaryArticles(8),
  ]);

  const map = (
    section: ArchiveSection,
    rows: Awaited<ReturnType<typeof getSummaryArticles>>,
  ): ArchiveItem[] =>
    rows.map((a) => ({
      section,
      slug: a.slug,
      title: a.title,
      excerpt: truncateDescription(a.summary, 130),
      date: a.date,
    }));

  return [
    ...map('geopolitics', geo),
    ...map('markets', markets),
    ...map('tech', tech),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 12);
}

function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function AuthorPage({ params }: Props) {
  const { slug } = await params;
  const author = getAuthorBySlug(slug);
  if (!author) notFound();

  const archive = await getAuthorArchive();

  const profileGraph = profilePageSchema(author, sebastianPereiraSchema());
  const breadcrumbs = breadcrumbSchema([
    { name: 'Home', url: canonicalUrl('/') },
    { name: author.name, url: author.profileUrl },
  ]);

  return (
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(profileGraph) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }}
      />

      <main className="author-profile">
        <header className="author-profile-hero">
          <div className="author-profile-avatar">
            {author.avatarUrl ? (
              <Image
                src={author.avatarUrl}
                alt={author.name}
                width={96}
                height={96}
                priority
                className="author-profile-avatar-img"
              />
            ) : (
              <span className="author-profile-initials" aria-hidden="true">
                {author.initials}
              </span>
            )}
          </div>
          <div className="author-profile-meta">
            <div className="author-profile-headrow">
              <h1 className="author-profile-name">{author.name}</h1>
              <span className="author-profile-badge">
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
                  <path
                    d="M3.5 8.5l3 3 6-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Editorial Verified
              </span>
            </div>
            <p className="author-profile-title">{author.jobTitle}</p>
            <p className="author-profile-bio">{author.bio}</p>
            {author.linkedInUrl ? (
              <a
                href={author.linkedInUrl}
                target="_blank"
                rel="noopener noreferrer me author"
                className="author-profile-link"
              >
                LinkedIn profile →
              </a>
            ) : null}
          </div>
        </header>

        {archive.length > 0 ? (
          <section className="author-archive" aria-labelledby="author-archive-heading">
            <h2 id="author-archive-heading" className="author-archive-heading">
              Recent Briefings
            </h2>
            <div className="author-archive-grid">
              {archive.map((item) => (
                <article
                  key={`${item.section}-${item.slug}`}
                  className="author-archive-card"
                >
                  <div className="author-archive-card-meta">
                    <span className="author-archive-badge">
                      {SECTION_LABEL[item.section]}
                    </span>
                    <time className="author-archive-date" dateTime={item.date}>
                      {formatDate(item.date)}
                    </time>
                  </div>
                  <a
                    className="author-archive-card-title"
                    href={`/${item.section}/${item.slug}`}
                  >
                    {item.title}
                  </a>
                  {item.excerpt ? (
                    <p className="author-archive-card-excerpt">{item.excerpt}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}

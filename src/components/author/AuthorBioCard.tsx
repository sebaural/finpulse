// src/components/author/AuthorBioCard.tsx

/**
 * AuthorBioCard — byline card shown at the foot of each briefing.
 *
 * SEO/GEO rationale: financial/geopolitical content is YMYL, where visible
 * author credentials are an E-E-A-T signal. The article's NewsArticle.author
 * already links to this author's Person node by @id (see newsArticleSchema),
 * and the canonical Person/ProfilePage schema lives on /authors/[slug], so this
 * card is intentionally presentational — it does not re-emit a Person node
 * (which would duplicate the canonical @id across every article).
 *
 * Used in src/app/{geopolitics,markets,tech}/[slug]/page.tsx, after the section
 * page-client. Renders outside .geo-root, so it carries its own theme tokens
 * via .author-card in author-bio-card.css.
 */

import Image from 'next/image';
import { SEBASTIAN_PEREIRA, type AuthorProfile } from '@/lib/seo';
import './author-bio-card.css';

interface AuthorBioCardProps {
  author?: AuthorProfile;
}

function CheckIcon() {
  return (
    <svg
      className="author-badge-icon"
      viewBox="0 0 16 16"
      width="12"
      height="12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

export default function AuthorBioCard({ author = SEBASTIAN_PEREIRA }: AuthorBioCardProps) {
  return (
    <div className="author-card-wrap">
      {/* <hr className="author-card-rule" /> */}
      <aside className="author-card" aria-label={`About the author, ${author.name}`}>
        <div className="author-card-avatar">
          {author.avatarUrl ? (
            <Image
              src={author.avatarUrl}
              alt={author.name}
              width={64}
              height={64}
              className="author-card-avatar-img"
            />
          ) : (
            <span className="author-card-initials" aria-hidden="true">
              {author.initials}
            </span>
          )}
        </div>

        <div className="author-card-body">
          <div className="author-card-headrow">
            <a className="author-card-name" href={author.profileUrl}>
              {author.name}
            </a>
            <span className="author-card-badge">
              <CheckIcon />
              Editorial Verified
            </span>
          </div>
          <div className="author-card-title">{author.jobTitle}</div>
          <p className="author-card-bio">{author.bio}</p>
          {author.linkedInUrl ? (
            <div className="author-card-social">
              <a
                href={author.linkedInUrl}
                target="_blank"
                rel="noopener noreferrer me author"
                className="author-card-social-link"
                aria-label={`${author.name} on LinkedIn`}
              >
                <LinkedInIcon />
                <span>LinkedIn</span>
              </a>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

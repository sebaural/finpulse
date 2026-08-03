// src/components/related/RelatedBriefings.tsx

/**
 * RelatedBriefings — server component rendering a band of internal links to
 * other briefings beneath an article.
 *
 * SEO/GEO rationale: article pages were internal-linking "islands"; this widget
 * lets PageRank flow across the archive and lets AI crawlers discover sibling
 * briefings. Links are server-rendered (plain <a>) so they appear in the static
 * HTML. Used in src/app/{geopolitics,markets,tech}/[slug]/page.tsx, rendered
 * after the section page-client (outside .geo-root, so it carries its own theme
 * tokens via .related-root in related-briefings.css).
 */

import { getRelatedBriefings, type BriefingSection } from '@/lib/related-service';
import './related-briefings.css';

const SECTION_LABEL: Record<BriefingSection, string> = {
  geopolitics: 'Geopolitics',
  markets: 'Markets',
  tech: 'Technology',
};

function formatDate(date: string): string {
  // `date` is stored as a YYYY-MM-DD string; render in UTC for determinism.
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

interface RelatedBriefingsProps {
  currentSlug: string;
  currentTags: string[];
  limit?: number;
}

export default async function RelatedBriefings({
  currentSlug,
  currentTags,
  limit = 4,
}: RelatedBriefingsProps) {
  const related = await getRelatedBriefings(currentSlug, currentTags, limit);
  if (related.length === 0) return null;

  return (
    <section className="related-root" aria-labelledby="related-briefings-heading">
      <div className="related-container">
        <h2 id="related-briefings-heading" className="related-heading">
          Related Briefings
        </h2>
        <div className="related-grid">
          {related.map((briefing) => (
            <article
              key={`${briefing.section}-${briefing.slug}`}
              className="related-card"
            >
              <div className="related-card-meta">
                <span className="related-badge">{SECTION_LABEL[briefing.section]}</span>
                <time className="related-date" dateTime={briefing.date}>
                  {formatDate(briefing.date)}
                </time>
              </div>
              <a
                className="related-card-title"
                href={
                  briefing.topicSlug
                    ? `/topics/${briefing.topicSlug}/${briefing.slug}`
                    : `/${briefing.section}/${briefing.slug}`
                }
              >
                {briefing.title}
              </a>
              {briefing.excerpt ? (
                <p className="related-card-excerpt">{briefing.excerpt}</p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

import Link from 'next/link';
import { PULSE_CATEGORIES } from '@/lib/pulse-categories';
import type { PulseArticle, PulseSlug } from '@/types/pulse';
import './pulse.css';

interface PulseHighlightsProps {
  latestByCategory: Record<PulseSlug, PulseArticle | null>;
}

export function PulseHighlights({ latestByCategory }: PulseHighlightsProps) {
  return (
    <section aria-label="Latest Pulse Updates" className="pulse-highlights widget">
      <h2 className="widget-title">Pulse</h2>
      <div className="pulse-highlights-grid">
        {Object.values(PULSE_CATEGORIES).map((config) => {
          const article = latestByCategory[config.pulseSlug];
          return (
            <Link
              key={config.pulseSlug}
              href={`/pulse/${config.pulseSlug}`}
              className="pulse-highlight-card"
            >
              <span className="pulse-highlight-label">{config.label}</span>
              <span className="pulse-highlight-title">{article ? article.title : 'No updates yet'}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

'use client';

import { useMemo, useState } from 'react';
import type { OverviewCategorySlug } from '@/lib/overview-categories';
import type { OverviewDayView } from '@/types/overview';
import OverviewControls from './OverviewControls';
import OverviewBlockCard from './OverviewBlockCard';

interface Props {
  days: OverviewDayView[];
}

function OverviewSubscribeCta() {
  return (
    <form className="overview-subscribe-cta" onSubmit={(e) => e.preventDefault()}>
      <div className="overview-cta-text">
        Get this briefing in your inbox every weekday
        <span>Free. No spam. Unsubscribe anytime.</span>
      </div>
      <div className="overview-cta-input-group">
        <input type="email" placeholder="your@email.com" />
        <button type="submit" className="overview-cta-button">
          Subscribe
        </button>
      </div>
    </form>
  );
}

export default function OverviewFeed({ days }: Props) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<OverviewCategorySlug | 'all'>('all');
  // Tracks the single open block across the WHOLE feed (not per-day) —
  // opening one block closes whichever other block was open, anywhere on
  // the page.
  const [openBlockId, setOpenBlockId] = useState<string | null>(null);

  const toggleBlock = (id: string) => {
    setOpenBlockId((current) => (current === id ? null : id));
  };

  const filteredDays = useMemo(() => {
    const query = search.trim().toLowerCase();

    return days
      .map((day) => ({
        ...day,
        blocks: day.blocks.filter((block) => {
          const matchesCategory = activeCategory === 'all' || block.category === activeCategory;
          const matchesSearch =
            !query ||
            block.title.toLowerCase().includes(query) ||
            block.description.toLowerCase().includes(query);
          return matchesCategory && matchesSearch;
        }),
      }))
      .filter((day) => day.blocks.length > 0);
  }, [days, search, activeCategory]);

  return (
    <>
      <OverviewControls
        search={search}
        onSearchChange={setSearch}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
      />

      {filteredDays.length === 0 ? (
        <div className="overview-no-results">No briefings match your search or filter.</div>
      ) : (
        <div className="overview-feed">
          {filteredDays.map((day) => (
            <section key={day.id} className="overview-day-section">
              <div className="overview-day-header">
                <span className="overview-day-date">{day.dateLabel}</span>
                {day.isToday && <span className="overview-badge-today">Latest</span>}
              </div>
              {day.context && <div className="overview-day-context">{day.context}</div>}
              <div className="overview-block-list">
                {day.blocks.map((block) => (
                  <OverviewBlockCard
                    key={block.id}
                    block={block}
                    isOpen={openBlockId === block.id}
                    onToggle={() => toggleBlock(block.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <OverviewSubscribeCta />
    </>
  );
}

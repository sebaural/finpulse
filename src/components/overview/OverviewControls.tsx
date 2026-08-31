'use client';

import type { CSSProperties } from 'react';
import {
  OVERVIEW_CATEGORIES,
  OVERVIEW_CATEGORY_SLUGS,
  type OverviewCategorySlug,
} from '@/lib/overview-categories';

interface Props {
  search: string;
  onSearchChange: (value: string) => void;
  activeCategory: OverviewCategorySlug | 'all';
  onCategoryChange: (value: OverviewCategorySlug | 'all') => void;
}

export default function OverviewControls({
  search,
  onSearchChange,
  activeCategory,
  onCategoryChange,
}: Props) {
  return (
    <div className="overview-controls">
      <div className="overview-search-box">
        <span className="overview-search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          type="text"
          placeholder="Search briefings…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search briefings"
        />
      </div>
      <div className="overview-filter-pills" role="group" aria-label="Filter by region">
        <button
          type="button"
          className={`overview-filter-pill${activeCategory === 'all' ? ' active' : ''}`}
          onClick={() => onCategoryChange('all')}
        >
          All
        </button>
        {OVERVIEW_CATEGORY_SLUGS.map((slug) => {
          const config = OVERVIEW_CATEGORIES[slug];
          return (
            <button
              key={slug}
              type="button"
              className={`overview-filter-pill${activeCategory === slug ? ' active' : ''}`}
              style={{ '--accent': config.accent } as CSSProperties}
              onClick={() => onCategoryChange(slug)}
            >
              {config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

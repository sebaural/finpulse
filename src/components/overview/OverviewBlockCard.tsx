'use client';

import type { CSSProperties } from 'react';
import { OVERVIEW_CATEGORIES } from '@/lib/overview-categories';
import type { OverviewBlockView } from '@/types/overview';

interface Props {
  block: OverviewBlockView;
  isOpen: boolean;
  onToggle: () => void;
}

export default function OverviewBlockCard({ block, isOpen, onToggle }: Props) {
  const config = OVERVIEW_CATEGORIES[block.category];
  const panelId = `overview-block-summary-${block.id}`;

  return (
    <div
      className={`overview-block-card${isOpen ? ' is-open' : ''}`}
      style={{ '--accent': config.accent } as CSSProperties}
    >
      <div className="overview-block-trigger" onClick={onToggle}>
        <span className="overview-block-tag">{config.label}</span>
        <h2 className="overview-item-title">{block.title}</h2>
        <div className="overview-item-desc">{block.description}</div>
        <button
          type="button"
          className="overview-block-chevron"
          aria-expanded={isOpen}
          aria-controls={panelId}
          aria-label={isOpen ? 'Collapse summary' : 'Expand summary'}
        >
          <span aria-hidden="true">{isOpen ? '▴' : '▾'}</span>
        </button>
      </div>
      <div id={panelId} className="overview-item-summary">
        {block.summary}
      </div>
    </div>
  );
}

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
      <button
        type="button"
        className="overview-block-trigger"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
      >
        <span className="overview-block-tag">{config.label}</span>
        <span className="overview-block-title">{block.title}</span>
        <span className="overview-block-description">{block.description}</span>
        <span className="overview-block-chevron" aria-hidden="true">
          {isOpen ? '▴' : '▾'}
        </span>
      </button>
      <div id={panelId} className="overview-block-summary">
        <p>{block.summary}</p>
      </div>
    </div>
  );
}

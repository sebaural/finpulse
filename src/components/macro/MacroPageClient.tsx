'use client';

import { useState } from 'react';
import type {
  AdjacentMacroArticleInfo,
  MacroArticleResponse,
} from '@/types/macro';
import './macro.css';

interface Props {
  /** Server-fetched latest (or deep-linked) entry plus its adjacency. */
  initial: MacroArticleResponse;
}

function formatFullDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function MacroPageClient({ initial }: Props) {
  const [state, setState] = useState<MacroArticleResponse>(initial);
  const [loading, setLoading] = useState(false);

  async function step(target: AdjacentMacroArticleInfo) {
    setLoading(true);
    try {
      const res = await fetch(`/api/macro/articles?date=${target.publishedDate}`);
      if (!res.ok) return;
      const data = (await res.json()) as MacroArticleResponse;
      setState(data);
    } catch {
      // Leave the current entry in place on a transient fetch failure.
    } finally {
      setLoading(false);
    }
  }

  const { article, previous, next } = state;

  if (!article) {
    return (
      <section className="macro-landscape">
        <span className="macro-eyebrow">The Macro Landscape</span>
        <p className="macro-empty">
          Today&apos;s macro summary will appear here once the daily pipeline has run.
        </p>
      </section>
    );
  }

  return (
    <section className="macro-landscape">
      <span className="macro-eyebrow">The Macro Landscape</span>
      <h2 className="macro-title">{article.title}</h2>
      <div className="macro-date">{formatFullDate(article.publishedDate)}</div>

      <div
        className="macro-body"
        // body is a server-sanitized HTML fragment (sanitizeArticleHtml on write).
        dangerouslySetInnerHTML={{ __html: article.body }}
      />

      <div className="macro-pager">
        <button
          type="button"
          className="macro-pager-btn"
          onClick={() => previous && step(previous)}
          disabled={loading || !previous}
        >
          ← Previous
        </button>
        {next && (
          <button
            type="button"
            className="macro-pager-btn"
            onClick={() => step(next)}
            disabled={loading}
          >
            Next →
          </button>
        )}
        {loading && <span className="macro-pager-spinner">Loading…</span>}
      </div>
    </section>
  );
}

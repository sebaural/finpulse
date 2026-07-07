'use client';

import { useRouter } from 'next/navigation';
import { isPulseHtmlFragment, sanitizePulseHtml } from '@/lib/pulse-html';
import type { PulseArticle } from '@/types/pulse';

function renderBody(body: string): string[] {
  return body
    .split(/\n\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
}

export function PulseArticleModal({
  article,
  onClose,
}: {
  article: PulseArticle;
  onClose?: () => void;
}) {
  const router = useRouter();
  const close = () => {
    if (onClose) {
      onClose();
      return;
    }

    router.back();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={article.title}
      className="pulse-modal-overlay"
      onClick={close}
    >
      <div className="pulse-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pulse-modal-close" onClick={close} aria-label="Close">
          ×
        </button>
        <h2>{article.title}</h2>
        {article.summary ? <p className="pulse-summary">{article.summary}</p> : null}
        {article.body && isPulseHtmlFragment(article.body) ? (
          <div
            className="pulse-body pulse-body--html"
            dangerouslySetInnerHTML={{ __html: sanitizePulseHtml(article.body) }}
          />
        ) : article.body ? (
          <div className="pulse-body">
            {renderBody(article.body).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        ) : null}
        {article.sourceUrl ? (
          <a href={article.sourceUrl} target="_blank" rel="noreferrer" className="pulse-source-link">
            View source
          </a>
        ) : null}
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import SubscribeCta from './SubscribeCta';

interface Props {
  onClose: () => void;
}

// Rendered inline (no portal) so it keeps the colour tokens defined on
// .overview-root; position: fixed still anchors it to the viewport.
export default function SubscribeModal({ onClose }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="overview-subscribe-modal-backdrop" onClick={onClose}>
      <div
        className="overview-subscribe-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Subscribe"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="overview-subscribe-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <SubscribeCta autoFocus />
      </div>
    </div>
  );
}

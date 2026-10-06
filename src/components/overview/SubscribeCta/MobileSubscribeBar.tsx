'use client';

import { useCallback, useState } from 'react';
import SubscribeModal from './SubscribeModal';
import './SubscribeCta.css';

export default function MobileSubscribeBar() {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  // The modal is a sibling of the sticky bar, not a child: the bar's z-index
  // creates a stacking context that would trap the modal under the site header.
  return (
    <>
      <div className="overview-subscribe-bar">
        <button
          type="button"
          className="overview-cta-button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
        >
          Subscribe
        </button>
      </div>
      {open && <SubscribeModal onClose={close} />}
    </>
  );
}

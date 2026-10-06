'use client';

import './SubscribeCta.css';

interface Props {
  autoFocus?: boolean;
}

export default function SubscribeCta({ autoFocus = false }: Props) {
  return (
    <form className="overview-subscribe-cta" onSubmit={(e) => e.preventDefault()}>
      <div className="overview-cta-text">
        Get this briefing in your inbox every weekday
        <span>Free. No spam. Unsubscribe anytime.</span>
      </div>
      <div className="overview-cta-input-group">
        <input type="email" placeholder="your@email.com" autoFocus={autoFocus} />
        <button type="submit" className="overview-cta-button">
          Subscribe
        </button>
      </div>
    </form>
  );
}

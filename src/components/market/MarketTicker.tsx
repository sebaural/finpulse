'use client';

import { useRef } from 'react';
import { TickerItem } from '@/types';

interface MarketTickerProps {
  items: TickerItem[];
}

export function MarketTicker({ items }: MarketTickerProps) {
  const innerRef = useRef<HTMLDivElement>(null);

  function pause() {
    if (innerRef.current) innerRef.current.style.animationPlayState = 'paused';
  }
  function resume() {
    if (innerRef.current) innerRef.current.style.animationPlayState = 'running';
  }

  return (
    <div className="ticker-wrap" aria-label="Market ticker" onMouseEnter={pause} onMouseLeave={resume}>
      <div className="ticker-inner" ref={innerRef}>
        {items.concat(items).map((item, idx) => (
          <span className="ticker-item" key={`${item.symbol}-${idx}`}>
            <span className="sym">{item.symbol}</span> {item.value}{' '}
            <span className={item.direction}>
              {item.direction === 'pos' ? `+${item.change.replace('+', '')}` : item.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

import { TickerItem } from '@/types';

interface MarketTickerProps {
  items: TickerItem[];
}

export function MarketTicker({ items }: MarketTickerProps) {
  return (
    <div className="ticker-wrap" aria-label="Market ticker">
      <div className="ticker-inner">
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

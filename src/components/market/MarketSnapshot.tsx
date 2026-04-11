import { MarketRow } from '@/types';

interface MarketSnapshotProps {
  rows: MarketRow[];
  isLive?: boolean;
}

export function MarketSnapshot({ rows, isLive }: MarketSnapshotProps) {
  return (
    <section className="widget">
      <div className="widget-title">
        Market Snapshot
        {isLive && <span className="market-live-dot" title="Live data" />}
      </div>
      {rows.map((row) => (
        <div className="market-row" key={row.name}>
          <span className="market-name">{row.name}</span>
          <span className="market-val">{row.value}</span>
          <span className={`market-chg ${row.direction}`}>{row.change}</span>
        </div>
      ))}
    </section>
  );
}

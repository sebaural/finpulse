export interface MarketRow {
  name: string;
  value: string;
  change: string;
  direction: 'pos' | 'neg';
}

export interface TickerItem {
  symbol: string;
  value: string;
  change: string;
  direction: 'pos' | 'neg';
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MarketRow } from '@/types';

interface SearchResult {
  symbol: string;
  description: string;
}

interface QuoteLookupProps {
  trackedSymbols: Set<string>;
  onAdd: (symbol: string, label: string) => void;
}

function QuoteLookup({ trackedSymbols, onAdd }: QuoteLookupProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [tooltip, setTooltip] = useState('');
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (!q) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`);
        const data = (await res.json()) as { results: SearchResult[] };
        const r = data.results ?? [];
        setResults(r);
        setOpen(r.length > 0);
        setActiveIdx(-1);
      } catch {
        setResults([]);
        setOpen(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  function select(r: SearchResult) {
    if (trackedSymbols.has(r.symbol)) {
      setTooltip('Already tracked');
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = setTimeout(() => setTooltip(''), 2000);
      return;
    }
    onAdd(r.symbol, r.symbol);
    setQuery('');
    setResults([]);
    setOpen(false);
    setTooltip('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && activeIdx >= 0 && results[activeIdx]) select(results[activeIdx]);
  }

  return (
    <div className="quote-lookup-wrap" ref={wrapRef}>
      <div className="quote-lookup-row">
        <span className="quote-lookup-icon">🔍</span>
        <input
          className="quote-lookup-input"
          type="text"
          placeholder="Quote Lookup"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      {tooltip && <div className="quote-tooltip">{tooltip}</div>}
      {open && (
        <ul className="quote-dropdown" role="listbox">
          {results.map((r, i) => (
            <li
              key={r.symbol}
              className={`quote-dropdown-item${i === activeIdx ? ' active' : ''}`}
              onMouseDown={() => select(r)}
              role="option"
              aria-selected={i === activeIdx}
            >
              <span className="quote-dd-sym">{r.symbol}</span>
              <span className="quote-dd-desc">{r.description}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface MarketSnapshotProps {
  rows: MarketRow[];
  isLive?: boolean;
  loadingNames?: Set<string>;
  onAdd?: (symbol: string, label: string) => void;
  onRemove?: (name: string) => void;
}

interface MarketSnapshotModalProps extends MarketSnapshotProps {
  onClose: () => void;
}

export function MarketSnapshotModal({ onClose, ...props }: MarketSnapshotModalProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, []);

  return createPortal(
    <div
      className="msm-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="msm-panel" role="dialog" aria-modal="true" aria-label="Market Snapshot">
        <div className="msm-header">
          <span className="msm-title">
            Market Snapshot
            {props.isLive && <span className="market-live-dot" title="Live data" />}
          </span>
          <button className="msm-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="msm-body">
          <MarketSnapshot {...props} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function MarketSnapshot({ rows, isLive, loadingNames, onAdd, onRemove }: MarketSnapshotProps) {
  const trackedSymbols = new Set(rows.map((r) => r.name));

  return (
    <section className="widget market-snapshot" aria-label="Market snapshot">
      <div className="widget-title">
        Market Snapshot
        {isLive && <span className="market-live-dot" title="Live data" />}
      </div>
      {rows.map((row) => (
        <div className="market-row" key={row.name}>
          <span className="market-name">{row.name}</span>
          {loadingNames?.has(row.name) ? (
            <>
              <span className="market-skeleton-val" />
              <span className="market-skeleton-chg" />
            </>
          ) : (
            <>
              <span className="market-val">{row.value}</span>
              <span className={`market-chg ${row.direction}`}>{row.change}</span>
            </>
          )}
          {onRemove && (
            <button
              className="market-row-remove"
              onClick={() => onRemove(row.name)}
              aria-label={`Remove ${row.name}`}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {onAdd && <QuoteLookup trackedSymbols={trackedSymbols} onAdd={onAdd} />}
    </section>
  );
}

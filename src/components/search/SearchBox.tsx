"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useDebounce } from "@/hooks/useDebounce";
import type { SearchResult } from "@/app/api/search/route";
import "./searchbox.css";

interface SearchBoxProps {
  placeholder?: string;
  autoFocus?: boolean;
  maxResults?: number;
  /** Clears the input after a result is selected. Default true. */
  clearOnSelect?: boolean;
  /** Optional class applied to the outer wrapper, for layout control per placement. */
  className?: string;
}

const SECTION_LABELS: Record<SearchResult["section"], string> = {
  pulse: "Pulse",
  markets: "Markets",
  tech: "Tech",
  geopolitics: "Geopolitics",
};

export default function SearchBox({
  placeholder = "Search articles...",
  autoFocus = false,
  maxResults = 6,
  clearOnSelect = true,
  className = "",
}: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debouncedQuery = useDebounce(query.trim(), 300);

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : { results: [] }))
      .then((data) => {
        setResults(data.results ?? []);
        setActiveIndex(-1);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Search failed:", err);
          setResults([]);
        }
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [debouncedQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleResults = results.slice(0, maxResults);
  const showDropdown = isOpen && query.trim().length >= 2;
  const noResults = showDropdown && !isLoading && visibleResults.length === 0;

  const handleSelect = () => {
    setIsOpen(false);
    if (clearOnSelect) setQuery("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || visibleResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % visibleResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + visibleResults.length) % visibleResults.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0) {
        window.location.href = visibleResults[activeIndex].url;
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className={`searchbox ${className}`.trim()} ref={containerRef}>
      <input
        type="text"
        className="searchbox-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-label="Search"
        aria-expanded={showDropdown}
        aria-autocomplete="list"
        role="combobox"
      />

      {showDropdown && (
        <div className="searchbox-dropdown" role="listbox">
          {isLoading && <div className="searchbox-status">Searching…</div>}

          {noResults && (
            <div className="searchbox-status">
              No results for &ldquo;{query.trim()}&rdquo;. Try a different term.
            </div>
          )}

          {!isLoading &&
            visibleResults.map((r, i) => (
              <Link
                key={r.url}
                href={r.url}
                className={`searchbox-item${i === activeIndex ? " active" : ""}`}
                onClick={handleSelect}
                role="option"
                aria-selected={i === activeIndex}
              >
                <span className="searchbox-item-section">{SECTION_LABELS[r.section]}</span>
                <span className="searchbox-item-title">{r.title}</span>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}


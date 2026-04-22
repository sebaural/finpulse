// src/components/NavMenu.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import './navmenu.css';

// ── Edit nav links here ────────────────────────────────────────────────────
const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Summaries', href: '/geopolitics' },
  // add more links here
] as const;
// ──────────────────────────────────────────────────────────────────────────

function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

export default function NavMenu({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Hide the link for the current exact home route
  const visibleLinks = NAV_LINKS.filter(
    ({ href }) => !(href === '/' && pathname === '/'),
  );

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close on outside pointer-down (works for both mouse and touch)
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (open && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <>
      <nav className="nav-menu" aria-label="Main navigation" data-variant={variant}>
        {/* Desktop horizontal links */}
        <ul className="nav-desktop">
          {visibleLinks.map(({ label, href }) => (
            <li key={href}>
              <Link
                href={href}
                className={`nav-desktop-link${isActive(href, pathname) ? ' active' : ''}`}
              >
                {href === '/geopolitics' && <span className="nav-dot" aria-hidden="true" />}
                {label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Hamburger (mobile) */}
        <button
          className={`nav-hamburger${open ? ' open' : ''}`}
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
        >
          <span className="nav-bar nav-bar-top" />
          <span className="nav-bar nav-bar-mid" />
          <span className="nav-bar nav-bar-bot" />
        </button>

      </nav>

      {/* Backdrop + Drawer portaled to document.body to escape any
          backdrop-filter / stacking-context containing-block on the parent */}
      {mounted && createPortal(
        <>
          {/* Inline position:fixed overrides any ancestor containing-block
              (backdrop-filter / overflow on header or body). */}
          <div
            className={`nav-backdrop${open ? ' visible' : ''}`}
            aria-hidden="true"
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          />

          <div
            ref={drawerRef}
            className={`nav-drawer${open ? ' open' : ''}`}
            style={{ position: 'fixed', top: 0, right: 0, zIndex: 9999 }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="nav-drawer-header">
              <span className="nav-drawer-label">Navigation</span>
              <button
                className="nav-drawer-close"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
              >
                ✕
              </button>
            </div>

            <ul className="nav-drawer-links">
              {visibleLinks.map(({ label, href }) => (
                <li key={href}>
                  <Link
                    href={href}
                    className={`nav-drawer-link${isActive(href, pathname) ? ' active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    {href === '/geopolitics' && <span className="nav-dot" aria-hidden="true" />}
                    {label}
                  </Link>
                </li>
              ))}
            </ul>

          </div>
        </>,
        document.body,
      )}
    </>
  );
}

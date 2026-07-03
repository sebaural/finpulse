// src/components/topNav/NavMenu.tsx
'use client';

import { Fragment, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PULSE_CATEGORIES } from '@/lib/pulse-categories';
import './navmenu.css';

// ── Edit nav links here ────────────────────────────────────────────────────
type NavLink = { label: string; href: string };
type NavItem =
  | { kind: 'link'; label: string; href: string }
  | { kind: 'group'; label: string; children: NavLink[] };

const NAV_ITEMS: NavItem[] = [
  { kind: 'link', label: 'Home', href: '/' },
  {
    kind: 'group',
    label: 'Summaries',
    children: [
      { label: 'Geopolitics', href: '/geopolitics' },
      { label: 'Markets', href: '/markets' },
      { label: 'Tech', href: '/tech' },
    ],
  },
  {
    kind: 'group',
    label: 'News Pulse',
    children: Object.values(PULSE_CATEGORIES).map((config) => ({
      label: config.label.toUpperCase(),
      href: `/pulse/${config.pulseSlug}`,
    })),
  },
];

const SUMMARY_HREFS = new Set(['/geopolitics', '/markets', '/tech']);
// ──────────────────────────────────────────────────────────────────────────

function isActive(href: string, pathname: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname.startsWith(href);
}

function subscribeNoop() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export default function NavMenu({ variant = 'dark' }: { variant?: 'dark' | 'light' }) {
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const mounted = useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
  const open = openPath === pathname;
  const closeMenu = () => setOpenPath(null);
  const toggleMenu = () => setOpenPath((current) => (current === pathname ? null : pathname));

  // Hide the link for the current exact home route
  const visibleItems = NAV_ITEMS.filter(
    (item) => !(item.kind === 'link' && item.href === '/' && pathname === '/'),
  );

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenPath(null);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close on outside pointer-down (works for both mouse and touch)
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (open && drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setOpenPath(null);
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
          {visibleItems.map((item) => {
            if (item.kind === 'link') {
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`nav-desktop-link${isActive(item.href, pathname) ? ' active' : ''}`}
                  >
                    {SUMMARY_HREFS.has(item.href) && <span className="nav-dot" aria-hidden="true" />}
                    {item.label}
                  </Link>
                </li>
              );
            }

            return (
              item.label === 'News Pulse' ? (
                <Fragment key={item.label}>
                  <li className="nav-desktop-sep" role="none" />
                  <li
                    className="pulse-desktop-dropdown"
                  >
                    <button
                      className={`nav-desktop-link nav-dropdown-trigger${
                        item.children.some((child) => isActive(child.href, pathname)) ? ' active' : ''
                      }`}
                      aria-haspopup="true"
                    >
                      News Pulse
                    </button>
                    <ul className="nav-desktop-dropdown-menu" role="menu" aria-label="News Pulse">
                      {item.children.map((child) => (
                        <li key={child.href} role="none">
                          <Link
                            role="menuitem"
                            href={child.href}
                            className={`nav-desktop-dropdown-link${
                              isActive(child.href, pathname) ? ' active' : ''
                            }`}
                          >
                            {child.label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </li>
                </Fragment>
              ) : (
                <Fragment key={item.label}>
                  {item.children.map((child, idx) => (
                    <Fragment key={child.href}>
                      {idx > 0 && <li className="nav-desktop-sep" role="none" />}
                      <li role="none">
                        <Link
                          role="menuitem"
                          href={child.href}
                          className={`nav-desktop-link${isActive(child.href, pathname) ? ' active' : ''}`}
                        >
                          <span className="nav-dot" aria-hidden="true" />
                          {child.label}
                        </Link>
                      </li>
                    </Fragment>
                  ))}
                </Fragment>
              )
            );
          })}
        </ul>

        {/* Hamburger (mobile) */}
        <button
          className={`nav-hamburger${open ? ' open' : ''}`}
          onClick={toggleMenu}
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
            onClick={closeMenu}
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          />

          <div
            ref={drawerRef}
            className={`nav-drawer${open ? ' open' : ''}`}
            style={{ position: 'fixed', top: 0, right: 0, zIndex: 9999 }}
            role="dialog"
            aria-modal="true"
            aria-label="Summaries menu"
          >
            <div className="nav-drawer-header">
              <span className="nav-drawer-label">Summaries</span>
              <button
                className="nav-drawer-close"
                onClick={closeMenu}
                aria-label="Close navigation"
              >
                ✕
              </button>
            </div>

            <ul className="nav-drawer-links">
              {visibleItems.map((item) => (
                item.kind === 'link' ? (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`nav-drawer-link${isActive(item.href, pathname) ? ' active' : ''}`}
                      onClick={closeMenu}
                    >
                      {SUMMARY_HREFS.has(item.href) && <span className="nav-dot" aria-hidden="true" />}
                      {item.label}
                    </Link>
                  </li>
                ) : (
                  <Fragment key={item.label}>
                    <li className="nav-drawer-group-label">{item.label}</li>
                    {item.children.map(({ label, href }) => (
                      <li key={href}>
                        <Link
                          href={href}
                          className={`nav-drawer-link${isActive(href, pathname) ? ' active' : ''}`}
                          onClick={closeMenu}
                        >
                          {SUMMARY_HREFS.has(href) && <span className="nav-dot" aria-hidden="true" />}
                          {label}
                        </Link>
                      </li>
                    ))}
                  </Fragment>
                )
              ))}
            </ul>

          </div>
        </>,
        document.body,
      )}
    </>
  );
}

---
name: "HTML Artifact to Next.js Rules"
description: "Use when migrating Claude artifacts or single-file HTML/CSS/JS prototypes into React, TypeScript, and Next.js. Covers client-only APIs, state migration, and parity-focused conversion."
applyTo: "**/*.{html,htm,js,jsx,ts,tsx}"
# Conversion Rules

## Scope
Apply these rules when the task is artifact migration, especially from prototype-style single files.

## Required Migration Behavior
- Preserve UX and visual intent unless the user explicitly requests redesign.
- Extract typed domain models before large refactors (for example article/news records).
- Replace inline DOM event handlers with React callbacks and hooks.
- Keep all loading, empty, error, and fallback states from the source artifact.

## Browser-Only APIs
- Treat `window`, `document`, `speechSynthesis`, `SpeechSynthesisUtterance`, `DOMParser`, and timers as client-side concerns.
- In Next.js, isolate browser-only logic inside client components or hooks.
- Add feature guards for unsupported browser capabilities and retain graceful fallback behavior.

## Data and State
- Prefer stable item IDs over index-based selection for playback, filtering, and navigation state.
- Preserve resilience for external feeds/APIs (network failures, CORS proxy failures, malformed payloads).
- Keep transformations deterministic and testable (parse, normalize, then render).

## File and Component Boundaries
- Split implementation into:
  - UI components
  - data utilities/parsers
  - hooks for browser integrations (voice, polling, timers)
- Keep component props and return values strictly typed.

## Validation
- Run target project checks when available: typecheck, lint, build, and relevant tests.
- If checks cannot run in the current workspace, explicitly report what was not verifiable.

## Project Reference
- Canonical conversion checklist: [artifact-to-nextjs-conversion-prompt.md](../../artifact-to-nextjs-conversion-prompt.md)
- Source prototype reference: [financial-news.html](../../financial-news.html)

# Project Guidelines

## Scope
- This repository is primarily a conversion-playbook workspace, not a full application codebase.
- Main assets:
  - `artifact-to-nextjs-conversion-prompt.md`: canonical conversion prompt and operational checklist.
  - `financial-news.html`: standalone prototype artifact with inline CSS/JS and browser APIs.

## Architecture
- Treat `financial-news.html` as a single-file reference implementation with three layers in one file:
  - Visual system and layout in the `<style>` block.
  - Markup structure and controls in the `<body>`.
  - Data loading, filtering, and voice playback logic in the `<script>` block.
- Conversion work should preserve this separation conceptually when moving to Next.js:
  - UI components
  - data-fetching and transformation utilities
  - browser-only voice playback hooks/client components

## Conventions
- Keep conversion instructions in `artifact-to-nextjs-conversion-prompt.md` as the source of truth; update there first when guidance changes.
- Preserve the current visual direction from the artifact unless explicitly asked to redesign (financial-news aesthetic, typography, color tokens, and motion cues).
- When converting to React/Next.js:
  - Use TypeScript with explicit interfaces for article/news models.
  - Move inline handlers to component callbacks and hooks.
  - Keep browser-only APIs (`window.speechSynthesis`, `SpeechSynthesisUtterance`, `DOMParser`) in client-only code paths.
  - Keep fallback behavior (demo articles) when network RSS fetch fails.

## Build and Test
- This repository does not define a local build/test pipeline.
- For generated Next.js targets, use the checklist in `artifact-to-nextjs-conversion-prompt.md`:
  - `npm install`
  - `npm run dev`
  - `npm run type-check`
  - `npm run lint`
  - `npm run build`

## Pitfalls
- RSS fetching currently relies on a public CORS proxy and can fail; keep robust fallback and user-visible error states.
- Voice features depend on browser support and available voices; always guard for unsupported environments.
- Filtering and playback state are index-based in the prototype; during conversion, prefer stable IDs to avoid mismatch after filtering/sorting.

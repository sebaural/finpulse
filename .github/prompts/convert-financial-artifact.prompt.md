---
name: "Convert Financial Artifact"
description: "Use when converting a financial/news prototype artifact to Next.js + TypeScript with behavior parity and production-ready structure."
argument-hint: "Artifact path + constraints (styling parity, API behavior, voice support, output structure)"
agent: "Artifact Migrator"
---
Convert the provided artifact into a production-ready Next.js App Router implementation with TypeScript.

Inputs:
- Artifact source path: ${input:Artifact path or pasted code}
- Required constraints: ${input:Constraints and must-keep behavior}

Execution requirements:
1. Analyze current UI sections, state, side effects, APIs, and browser-only dependencies.
2. Propose and then apply a file structure for `src/app`, `src/components`, `src/hooks`, `src/types`, and `src/lib`.
3. Preserve existing visual direction unless explicitly asked to redesign.
4. Migrate browser-only APIs into client-safe hooks/components with feature guards.
5. Replace index-based selection state with stable IDs where applicable.
6. Keep fallback and error behavior for failed feed/API loads.
7. Produce complete file outputs with explicit TypeScript types.
8. Run available checks and report outcomes.

Output format:
1. Implementation summary.
2. File-by-file changes.
3. Validation results.
4. Remaining risks and follow-up actions.

Context references:
- [artifact-to-nextjs-conversion-prompt.md](../../artifact-to-nextjs-conversion-prompt.md)
- [financial-news.html](../../financial-news.html)

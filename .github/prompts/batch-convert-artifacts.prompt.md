---
name: "Batch Convert Artifacts"
description: "Use when converting multiple HTML/CSS/JS or Claude artifacts to Next.js + TypeScript in one coordinated migration run."
argument-hint: "List artifact paths, migration constraints, and desired output structure"
agent: "Artifact Migrator"
---
Convert multiple artifacts into a single production-ready Next.js App Router codebase with TypeScript.

Inputs:
- Artifact paths or pasted sources: ${input:Artifact list}
- Shared constraints: ${input:Visual parity, API behavior, accessibility, voice/browser API requirements}
- Output strategy: ${input:Single unified app or separate feature modules}

Execution requirements:
1. Inventory all artifacts and identify overlap in components, models, and behaviors.
2. Define a shared typed domain model layer and resolve naming conflicts before implementation.
3. Propose and apply a consolidated file structure for src/app, src/components, src/hooks, src/types, and src/lib.
4. Preserve each artifact's required loading, empty, error, and fallback states.
5. Isolate browser-only APIs in client-safe hooks/components with feature guards.
6. Replace index-based selection or playback state with stable IDs.
7. Merge repeated styles/tokens into reusable design primitives while keeping intended visual identity.
8. Run available checks and report validation status.

Output format:
1. Consolidation plan and conflict-resolution decisions.
2. File-by-file implementation summary.
3. Per-artifact parity checklist.
4. Validation outcomes and unresolved risks.

Context references:
- [artifact-to-nextjs-conversion-prompt.md](../../artifact-to-nextjs-conversion-prompt.md)
- [financial-news.html](../../financial-news.html)
- [Artifact Migrator agent](../agents/artifact-migrator.agent.md)

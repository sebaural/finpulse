# FinPuls Architecture

## Layering Contract

- `src/app/*`: Next.js route handlers, page composition, and HTTP boundary concerns.
- `src/server/*`: server-side orchestration and infrastructure adapters reused by routes/pages.
- `src/lib/*`: domain logic and reusable library code for server concerns.
- `src/modules/*`: feature modules that package UI, hooks, and related utilities.

## Dependency Direction

- Allowed: `app -> server/lib/modules`
- Allowed: `server -> lib`
- Allowed: `modules -> lib` (when shared utilities are needed)
- Not allowed: `server/lib -> app/api/*`

## Maintainability Rules

- Keep API route files thin: parse request, call service, return response.
- Place cache/config stores in `src/server/*`, not under route directories.
- Reuse shared pipeline helpers for category generation flows (`geopolitics`, `markets`, `tech`).
- Keep one implementation per complex hook/utility and re-export for compatibility.

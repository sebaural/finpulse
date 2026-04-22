# FinPuls

## Dev and build note

This project pins `next dev` and `next build` to webpack in `package.json`:

- `npm run dev` -> `next dev --webpack`
- `npm run build` -> `next build --webpack`

Reason: on this Linux host, the Next 16 Turbopack path crashes during build with `Illegal instruction (core dumped)`, while the webpack path starts and builds successfully. This is a runtime/toolchain compatibility workaround, not an application-code fix.

If a future Next.js update resolves the Turbopack crash on this machine, these script flags can be re-evaluated.

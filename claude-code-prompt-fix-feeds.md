# Claude Code Prompt — Fix Feed Selection Persistence on Vercel

## Context

This is a Next.js app deployed on Vercel (finpulse-three.vercel.app).
The app has an "Admin Feed Settings" panel where users can toggle feeds on/off and click "Apply".
Currently, Apply does not persist because the app writes to `data/feeds.json` via `fs.writeFile()`,
which does not work on Vercel's serverless/read-only runtime filesystem.

## Goal

Fix the feed selection so that when a user checks/unchecks feeds and clicks "Apply",
the selection is saved and immediately reflected in the UI — across page refreshes.

## Chosen Solution: Vercel KV (Redis)

Replace the `data/feeds.json` filesystem store with **Vercel KV** for persistent key-value storage.
Vercel KV is a first-party Redis-compatible store that works natively in Vercel serverless functions.

---

## Step-by-Step Instructions

### Step 1 — Add Vercel KV dependency

```bash
npm install @vercel/kv
```

### Step 2 — Provision Vercel KV in the Vercel Dashboard

Instruct the user:
> In the Vercel dashboard → Storage → Create a KV database → Link it to this project.
> This auto-injects `KV_URL`, `KV_REST_API_URL`, and `KV_REST_API_TOKEN` as environment variables.
> For local dev, copy these into `.env.local`.

### Step 3 — Rewrite `src/lib/feedsStore.ts`

Replace the current filesystem-based implementation with Vercel KV:

```typescript
// src/lib/feedsStore.ts
import { kv } from '@vercel/kv';
import feedsDefault from '../../data/feeds.json'; // keep as fallback/seed

const KV_KEY = 'feeds:config';

export async function getFeeds() {
  const stored = await kv.get<typeof feedsDefault>(KV_KEY);
  if (!stored) {
    // First run: seed KV with the static JSON defaults
    await kv.set(KV_KEY, feedsDefault);
    return feedsDefault;
  }
  return stored;
}

export async function updateFeed(id: string, updates: Partial<{ enabled: boolean; [key: string]: unknown }>) {
  const feeds = await getFeeds();
  const updated = (feeds as Array<{ id: string; [key: string]: unknown }>).map(feed =>
    feed.id === id ? { ...feed, ...updates } : feed
  );
  await kv.set(KV_KEY, updated);
  return updated;
}

export async function setAllFeeds(feeds: unknown) {
  await kv.set(KV_KEY, feeds);
  return feeds;
}
```

### Step 4 — Update `src/app/api/feeds/route.ts`

Ensure the GET and POST/PUT handlers use the new store:

```typescript
// src/app/api/feeds/route.ts
import { NextResponse } from 'next/server';
import { getFeeds, setAllFeeds } from '@/lib/feedsStore';

export async function GET() {
  const feeds = await getFeeds();
  return NextResponse.json(feeds);
}

export async function POST(request: Request) {
  const body = await request.json();
  // body should be the full updated feeds array
  const updated = await setAllFeeds(body);
  return NextResponse.json(updated);
}
```

### Step 5 — Update `src/app/api/feeds/[id]/route.ts`

```typescript
// src/app/api/feeds/[id]/route.ts
import { NextResponse } from 'next/server';
import { updateFeed } from '@/lib/feedsStore';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await request.json();
  const updated = await updateFeed(params.id, body);
  return NextResponse.json(updated);
}
```

### Step 6 — Verify the frontend "Apply" button calls the API correctly

In the relevant component (likely in `src/app/page.tsx` or a feeds component):

- Confirm the "Apply" button handler calls `POST /api/feeds` with the full updated feeds array.
- Confirm the feeds list is loaded via `GET /api/feeds` on mount (not from a static import of `feeds.json`).
- After a successful POST response, update local React state with the response data so the UI reflects the change immediately.

The Apply handler should look like this:

```typescript
const handleApply = async () => {
  const response = await fetch('/api/feeds', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(localFeedsState),
  });
  if (response.ok) {
    const saved = await response.json();
    setFeeds(saved); // update React state
  }
};
```

### Step 7 — Add environment variables to `.env.local` for local dev

```
KV_REST_API_URL=<from Vercel KV dashboard>
KV_REST_API_TOKEN=<from Vercel KV dashboard>
```

### Step 8 — Test locally and deploy

```bash
npm run dev
# Test: toggle feeds, click Apply, refresh — selection should persist

git add -A && git commit -m "fix: persist feed selection via Vercel KV" && git push
```

---

## Fallback Option: localStorage (if Vercel KV setup is not desired)

If the user wants a simpler client-only fix with no backend changes:

Remove all API write calls. Instead, in the frontend component:

```typescript
// On load: read from localStorage
const saved = localStorage.getItem('feedsConfig');
if (saved) setFeeds(JSON.parse(saved));

// On Apply click:
const handleApply = () => {
  localStorage.setItem('feedsConfig', JSON.stringify(localFeedsState));
  setFeeds(localFeedsState);
};
```

This requires no backend changes and works immediately, but is per-browser only.

---

## Files to modify (summary)

| File | Change |
|------|--------|
| `src/lib/feedsStore.ts` | Replace fs-based store with Vercel KV |
| `src/app/api/feeds/route.ts` | Use new store; add POST handler |
| `src/app/api/feeds/[id]/route.ts` | Use new store for PATCH |
| `src/app/page.tsx` (or feeds component) | Ensure Apply calls POST /api/feeds and updates state |
| `package.json` | Add `@vercel/kv` |
| `.env.local` | Add KV credentials |

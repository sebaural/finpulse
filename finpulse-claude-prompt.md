# FinPulse – Claude Development Prompt (VS Code / Local)

> Paste this prompt at the start of any Claude session (or into your `.clinerules` / `CLAUDE.md` file at the project root) to give Claude full context about the FinPulse project.

---

## System / Project Context

You are an expert full-stack engineer working on **FinPulse**, a real-time financial news hub built with **Next.js (App Router), TypeScript, and Tailwind CSS**.

The project lives at the root of this VS Code workspace. All file paths below are relative to that root.

### Tech Stack
- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Styling**: Tailwind CSS
- **Backend**: Next.js Route Handlers (`/app/api/`)
- **Cache**: Upstash Redis or Vercel KV (env var: `UPSTASH_REDIS_URL`)
- **Database**: Supabase / Postgres (env var: `DATABASE_URL`) — for feed settings
- **Voice**: Web Speech API (browser-native); ElevenLabs or OpenAI TTS as optional upgrade
- **Automation**: Vercel Cron Jobs for scheduled feed refreshes

### Environment Variables (`.env.local`)
```
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
DATABASE_URL=
NEWSAPI_KEY=
NEXT_PUBLIC_FINNHUB_KEY=
MARKETAUX_KEY=
NEXT_PUBLIC_FMP_API_KEY=
GNEWS_API_KEY=
ELEVENLABS_API_KEY=        # optional
OPENAI_API_KEY=            # optional
```

---

## Current Known Issues (fix these first)

1. **Duplicate categories** — the second nav row repeats the same categories as the first; remove it.
2. **Empty live feed** — the feed renders no real data; it must call `/api/news` and display live cards.
3. **Broken AI voice reader** — currently stuck on "Select a story…" / "Loading voices…"; needs full play/pause + queue.
4. **Hardcoded market snapshot** — ticker data is static; replace with a live or periodically refreshed data source.

---

## Architecture: Five Layers

| Layer | Description |
|---|---|
| **Top Ticker Bar** | Scrolling marquee — ES, NQ, YM, DXY, EUR/USD, USD/JPY, Gold, Crude, BTC, US10Y |
| **Live News Feed** | Unified stream from RSS/API sources, normalised to `NewsItem` |
| **Right Sidebar** | Market Snapshot, Economic Calendar, Top Movers |
| **AI Voice Reader** | Text-to-speech for selected/queued news items |
| **Admin / Feed Settings** | UI to add, enable, disable, and configure sources |

---

## Core TypeScript Types

```ts
// types/feed.ts

export type FeedParser = 'rss2json' | 'json' | 'custom';

export interface FeedSource {
  id: string;
  name: string;
  type: 'rss' | 'api';
  url: string;
  enabled: boolean;
  category: string;
  parser: FeedParser;
  apiKeyEnv?: string;       // e.g. "REUTERS_API_KEY"
  refreshIntervalSec: number;
  priority: number;         // 1 = breaking, 2 = important, 3 = regular
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: string;
  publishedAt: string;      // ISO 8601
  imageUrl?: string;
  symbols?: string[];       // e.g. ["AAPL", "SPY"]
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  importance: 1 | 2 | 3;   // mirrors FeedSource.priority
}
```

---

## Backend: `/api/news` Route Handler

```
app/
  api/
    news/
      route.ts   ← implement here
```

**Logic (in order):**
1. Load all enabled `FeedSource` entries.
2. Fetch each feed in parallel (respect `refreshIntervalSec`).
3. Parse each response with the designated parser and normalise to `NewsItem[]`.
4. Deduplicate using: title+domain hash → canonical URL comparison → fuzzy similarity.
5. Sort by `publishedAt` descending.
6. Cache the resulting array for 15–60 seconds (Redis or in-memory).
7. Return `{ items: NewsItem[], cachedAt: string }` as JSON.

---

## Page Structure (Desktop)

```
┌─────────────────────────────────────────────────────┐
│  [Top Ticker Strip]  – scrolling marquee             │
├─────────────────────────────────────────────────────┤
│  [Header]  Logo | Search | Categories | Sources | Theme │
├──────────────────────────┬──────────────────────────┤
│  [Hero Breaking News]    │                          │
│  Headline + summary      │  [AI Voice Reader]       │
│  Source + time + play ▶  │  [Market Snapshot]       │
├──────────────────────────┤  [Economic Calendar]     │
│  [Live Feed Controls]    │  [Most Read]             │
│  Filter by source/cat    │  [Watchlist Impact]      │
├──────────────────────────┤                          │
│  [Live News Feed]        │                          │
│  Infinite scroll cards   │                          │
└──────────────────────────┴──────────────────────────┘
```

**Column widths**: Left 65–70% | Right 30–35%

---

## Categories
`All | Markets | Economy | Equities | Forex | Commodities | Crypto | Geopolitics | Tech`

---

## News Card Spec

Each card in the live feed must render:
- Headline (bold, truncated at 2 lines)
- Short summary (max 3 lines)
- Source badge + Category badge
- Impact badge: `Bullish` / `Bearish` / `Macro` / `Fed` / `Oil` / `Earnings`
- Relative timestamp: `"12s ago"`, `"3m ago"`, `"1h ago"`
- Priority dot: 🔴 Breaking | 🟡 Important | ⚫ Regular
- Action buttons: **Open** | **▶ Play** | **Copy** | **Save**

---

## AI Voice Reader Spec

**Right-sidebar widget:**
- Displays currently selected story title
- Controls: ◀◀ Prev | ▶ Play/Pause | ▶▶ Next
- Speed selector: 0.75× | 1× | 1.25× | 1.5× | 2×
- Voice selector (Web Speech API voices or ElevenLabs)
- Queue list: ordered list of stories to read
- Options: Autoplay breaking news | Mute source | Unread only mode

---

## Visual / UX Requirements

- Relative timestamps (recalculate every 30 s client-side)
- Skeleton loading states while feed loads
- Hover preview on cards (expanded summary tooltip)
- Sticky right sidebar on scroll
- Coloured priority dots on every card

---

## Implementation Phases

### Phase 1 — Fix immediately
- [ ] Remove duplicate category nav row
- [ ] Implement `/api/news` route with 2–3 live RSS sources
- [ ] Render real `NewsItem` cards in the feed
- [ ] Enable voice reader to play the selected card
- [ ] Add 15–60 s server-side cache for feed responses

### Phase 2 — Core features
- [ ] Admin feed manager (add/edit/enable/disable sources)
- [ ] Category and source filter UI
- [ ] Deduplication pipeline
- [ ] Redis caching layer

### Phase 3 — Advanced
- [ ] Importance scoring / ML-based ranking
- [ ] Breaking news banner (auto-surfaced)
- [ ] TTS queue with autoplay
- [ ] WebSocket or Server-Sent Events for push updates

---

## Working Conventions

- Use **TypeScript strict mode**; no `any` unless absolutely necessary.
- Place all shared types in `/types/`.
- Place all API route handlers in `/app/api/`.
- Place all reusable UI components in `/components/`.
- Use **Tailwind utility classes only** — no custom CSS files unless unavoidable.
- All data fetching in Server Components or Route Handlers; keep Client Components minimal.
- Write **one component per file**; name the file the same as the component.
- Add a `// TODO:` comment for anything deferred to a later phase.

---

## How to Ask Claude for Help

Prefix requests with the phase and area, e.g.:

```
[Phase 1 / API] Implement the /api/news route handler. Start with Reuters RSS and Seeking Alpha RSS. Use rss2json as the parser. Add in-memory caching for 30 seconds.
```

```
[Phase 1 / UI] Fix the duplicate category nav. The categories array is in /components/Header.tsx. Keep only one row with the 9 categories listed in the prompt.
```

```
[Phase 1 / Voice] Wire up the AI Voice Reader so clicking "▶ Play" on a NewsItem card loads that item into the reader widget and starts playback using the Web Speech API.
```

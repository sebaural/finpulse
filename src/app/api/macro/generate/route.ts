// src/app/api/macro/generate/route.ts
//
// Called by:
//   • Vercel Cron (GET) — authenticated via CRON_SECRET
//   • Manual POST (e.g. curl) — same CRON_SECRET auth
//   • Local dev GET (no secret required when NODE_ENV=development)
//
// This route does NOT read feeds.json and does not call feedsStore/gdelt/dedup.
// Its only inputs are the generation prompt and the model's own live web search
// (enabled inside runDailyMacroPipeline). See macro-landscape-feature-build-prompt.md §3.

import { NextRequest, NextResponse } from 'next/server';
import { runDailyMacroPipeline } from '@/lib/macro-service';
import { isCronAuthorized, runCronPipeline } from '@/server/cron';

// Live web search + generation can take a while; give it the full budget.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runCronPipeline(runDailyMacroPipeline);
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runCronPipeline(runDailyMacroPipeline);
}

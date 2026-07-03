// src/app/api/cron/generate/route.ts
//
// Unified daily content generation cron (geopolitics + markets + tech + pulse, sequential).
// Replaces the three separate /api/{geopolitics,markets,tech}/generate crons.
//
// Called by:
//   • Vercel Cron (GET, daily at 15:00 UTC) — authenticated via CRON_SECRET
//   • Manual POST (e.g. curl) — same CRON_SECRET auth
//   • Local dev GET (no secret required when NODE_ENV=development)

import { NextRequest, NextResponse } from 'next/server';
import { isCronAuthorized, runDailyContentPipelines } from '@/server/cron';

// Four pipelines run back-to-back; give the function the full duration budget.
export const maxDuration = 300;

// Vercel Cron always uses GET.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await runDailyContentPipelines();
  return NextResponse.json({ results });
}

// Keep POST for manual triggers (curl, Postman, etc.).
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await runDailyContentPipelines();
  return NextResponse.json({ results });
}

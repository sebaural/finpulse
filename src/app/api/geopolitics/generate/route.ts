// src/app/api/geopolitics/generate/route.ts
//
// Called by:
//   • Vercel Cron (GET, daily at 15:00 UTC) — authenticated via CRON_SECRET
//   • Manual POST (e.g. curl) — same CRON_SECRET auth
//   • Local dev GET (no secret required when NODE_ENV=development)

import { NextRequest, NextResponse } from 'next/server';
import { runDailyGeopoliticsPipeline } from '@/lib/geopolitics-service';
import { isCronAuthorized, runCronPipeline } from '@/server/cron';

// Vercel Cron always uses GET.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runCronPipeline(runDailyGeopoliticsPipeline);
}

// Keep POST for manual triggers (curl, Postman, etc.).
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runCronPipeline(runDailyGeopoliticsPipeline);
}

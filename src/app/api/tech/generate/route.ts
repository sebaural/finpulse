// src/app/api/tech/generate/route.ts
//
// Called by:
//   • Vercel Cron (GET, daily) — authenticated via CRON_SECRET
//   • Manual POST (e.g. curl) — same CRON_SECRET auth
//   • Local dev GET (no secret required when NODE_ENV=development)

import { NextRequest, NextResponse } from 'next/server';
import { runDailyTechPipeline } from '@/lib/tech-service';
import { isCronAuthorized, runCronPipeline } from '@/server/cron';

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runCronPipeline(runDailyTechPipeline);
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runCronPipeline(runDailyTechPipeline);
}

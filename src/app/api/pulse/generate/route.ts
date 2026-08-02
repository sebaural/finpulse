import { NextRequest, NextResponse } from 'next/server';
import { runDailyPulsePipeline } from '@/lib/pulse-service';
import { isCronAuthorized, runCronPipeline } from '@/server/cron';

// Dedicated route/budget: pulse's 4 categories run sequentially (see
// pulse-service.ts) so each category can be told what earlier categories
// already covered, which costs more wall-clock time than running in parallel.
// Kept out of the unified /api/cron/generate route so it can't eat into (or be
// starved by) geopolitics/markets/tech's shared budget.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runCronPipeline(runDailyPulsePipeline);
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runCronPipeline(runDailyPulsePipeline);
}

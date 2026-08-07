import { NextRequest, NextResponse } from 'next/server';
import { runDailyPulsePipeline } from '@/lib/pulse-service';
import { isCronAuthorized, runCronPipeline } from '@/server/cron';

// Dedicated route/budget: pulse's 4 categories run sequentially (see
// pulse-service.ts) so each category can be told what earlier categories
// already covered, which costs more wall-clock time than running in parallel.
// Kept out of the unified /api/cron/generate route so it can't eat into (or be
// starved by) geopolitics/markets/tech's shared budget.
//
// Even with its own budget, all 4 categories sequentially routinely exceed
// Hobby's hard 300s cap (the 4th — "strategic" in iteration order — was
// getting silently killed mid-flight). vercel.json now fires this route twice,
// an hour apart, with ?group=1 and ?group=2, each covering 2 categories; see
// PULSE_GROUPS in pulse-service.ts. An hour (not a few minutes) because Hobby
// cron precision is only accurate to the hour bucket, not the minute — see
// vercel.json. Omitting the group (manual/local trigger) still runs all 4
// sequentially in one shot.
export const maxDuration = 300;

function parseGroup(req: NextRequest): 1 | 2 | undefined {
  const raw = req.nextUrl.searchParams.get('group');
  return raw === '1' || raw === '2' ? Number(raw) as 1 | 2 : undefined;
}

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const group = parseGroup(req);
  return runCronPipeline(() => runDailyPulsePipeline(group));
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const group = parseGroup(req);
  return runCronPipeline(() => runDailyPulsePipeline(group));
}

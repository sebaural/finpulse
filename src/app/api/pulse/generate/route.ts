import { NextRequest, NextResponse } from 'next/server';
import { enqueuePulseCategories } from '@/lib/pulse-service';
import { isCronAuthorized, isCronPaused, runCronPipeline } from '@/server/cron';

// Daily cron entry point: ingests the Pulse news feeds, sorts stories into the
// 4 categories, and enqueues one QStash job per category to
// /api/pulse/process, where the actual RunPod generation happens (see
// pulse-service.ts). This route itself only does feed I/O and QStash publishes.
export const maxDuration = 300;

async function handle(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (isCronPaused()) {
    return NextResponse.json({ paused: true, until: process.env.CRON_PAUSE_UNTIL });
  }

  return runCronPipeline(() => enqueuePulseCategories());
}

export const GET = handle;
export const POST = handle;

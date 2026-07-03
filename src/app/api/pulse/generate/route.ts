import { NextRequest, NextResponse } from 'next/server';
import { syncAllPulseCategories } from '@/lib/pulse-service';
import { isCronAuthorized, runCronPipeline } from '@/server/cron';

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runCronPipeline(syncAllPulseCategories);
}

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return runCronPipeline(syncAllPulseCategories);
}

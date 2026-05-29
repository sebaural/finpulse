import { NextRequest, NextResponse } from 'next/server';
import { runXPosterPipeline } from '@/server/cron';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization') ?? '';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await runXPosterPipeline();
  return NextResponse.json({ results });
}

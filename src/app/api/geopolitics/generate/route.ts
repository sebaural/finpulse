// src/app/api/geopolitics/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { runDailyGeopoliticsPipeline } from '@/lib/geopolitics-service';

async function runPipeline() {
  const article = await runDailyGeopoliticsPipeline();
  return NextResponse.json({ success: true, article });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') ?? '';
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return await runPipeline();
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Pipeline failed', details }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
    }

    return await runPipeline();
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Pipeline failed', details }, { status: 500 });
  }
}

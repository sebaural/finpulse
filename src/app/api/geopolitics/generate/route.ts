// src/app/api/geopolitics/generate/route.ts
//
// Called by:
//   • Vercel Cron (GET, daily at 08:00 UTC) — authenticated via CRON_SECRET
//   • Manual POST (e.g. curl) — same CRON_SECRET auth
//   • Local dev GET (no secret required when NODE_ENV=development)

import { NextRequest, NextResponse } from 'next/server';
import { runDailyGeopoliticsPipeline } from '@/lib/geopolitics-service';

async function runPipeline() {
  const article = await runDailyGeopoliticsPipeline();
  return NextResponse.json({ success: true, article });
}

function isAuthorized(req: NextRequest): boolean {
  // In local dev the secret is optional so the endpoint is easy to test.
  if (process.env.NODE_ENV === 'development') return true;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false; // secret not configured → deny

  const authHeader = req.headers.get('authorization') ?? '';
  return authHeader === `Bearer ${cronSecret}`;
}

// Vercel Cron always uses GET.
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return await runPipeline();
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Pipeline failed', details }, { status: 500 });
  }
}

// Keep POST for manual triggers (curl, Postman, etc.).
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return await runPipeline();
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Pipeline failed', details }, { status: 500 });
  }
}

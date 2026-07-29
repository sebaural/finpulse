import { NextRequest, NextResponse } from 'next/server';
import { enqueueDailyClusters } from '@/lib/overview-service';
import { isCronAuthorized } from '@/server/cron';

export const maxDuration = 60;

// Vercel Cron always uses GET.
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await enqueueDailyClusters();
  return NextResponse.json({ ok: true, ...result });
}

// Keep POST for manual triggers (curl, Postman, etc.).
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await enqueueDailyClusters();
  return NextResponse.json({ ok: true, ...result });
}


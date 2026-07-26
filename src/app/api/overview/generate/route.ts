import { NextResponse } from 'next/server';
import { enqueueDailyClusters } from '@/lib/overview-service';

export const maxDuration = 60;

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await enqueueDailyClusters();
  return NextResponse.json({ ok: true, ...result });
}


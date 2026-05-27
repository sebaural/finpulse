import { NextRequest, NextResponse } from 'next/server';

export function isCronAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV === 'development') return true;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get('authorization') ?? '';
  return authHeader === `Bearer ${cronSecret}`;
}

export async function runCronPipeline<T>(
  pipeline: () => Promise<T>,
): Promise<NextResponse<{ success: true; article: T } | { error: string; details?: string }>> {
  try {
    const article = await pipeline();
    return NextResponse.json({ success: true, article });
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Pipeline failed', details }, { status: 500 });
  }
}

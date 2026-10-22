import { NextRequest, NextResponse } from 'next/server';
import { regeneratePulseArticle } from '@/lib/pulse-service';
import { isCronAuthorized } from '@/server/cron';

// Manual repair endpoint: rewrites one existing Pulse article in place (same
// URL) with the current prompt + quality gate. One article per call — a
// RunPod cold start alone can take minutes.
//   POST { "id": "<pulse_articles.id>", "dryRun": true }  (CRON_SECRET auth)
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id, dryRun } = (await req.json().catch(() => ({}))) as {
    id?: unknown;
    dryRun?: unknown;
  };
  if (typeof id !== 'string' || !id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  try {
    const result = await regeneratePulseArticle(id, { dryRun: dryRun === true });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[pulse/regenerate] failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Regeneration failed' },
      { status: 500 },
    );
  }
}

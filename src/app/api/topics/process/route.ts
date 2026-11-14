import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { processTopicCopy } from '@/lib/summary-pipeline';

// Generates the /topics/{topic}/{slug} article (own Title, Summary, Key points)
// on RunPod for one daily briefing. Enqueued by saveSummaryArticle in the
// geopolitics/markets/tech services. RunPod cold starts plus polling can take
// several minutes — see POLL_MAX_WAIT_MS in runpod.ts.
export const maxDuration = 300;

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('upstash-signature') ?? '';

  const isValid = await receiver.verify({ signature, body }).catch(() => false);
  if (!isValid) {
    console.error('[topics/process] invalid QStash signature — check QSTASH_CURRENT_SIGNING_KEY/QSTASH_NEXT_SIGNING_KEY');
    return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
  }

  try {
    const result = await processTopicCopy(JSON.parse(body));
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error('[topics/process] failed:', err);
    // Non-2xx so QStash retries (retries: 2 set at publish time).
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

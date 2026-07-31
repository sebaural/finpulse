import { NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { processCluster } from '@/lib/overview-service';

export const maxDuration = 60;

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(req: Request) {
  const body = await req.text();
  const signature = req.headers.get('upstash-signature') ?? '';

  const isValid = await receiver.verify({ signature, body });
  if (!isValid) {
    console.error('[overview/process] invalid QStash signature — check QSTASH_CURRENT_SIGNING_KEY/QSTASH_NEXT_SIGNING_KEY');
    return NextResponse.json({ error: 'Invalid QStash signature' }, { status: 401 });
  }

  try {
    const { cluster } = JSON.parse(body);
    await processCluster(cluster);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[overview/process] failed:', err);
    // Non-2xx so QStash retries per its own retry policy
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}


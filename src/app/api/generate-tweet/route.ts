import { NextRequest, NextResponse } from 'next/server';
import { generateTweet } from '@/lib/claude';
import type { XBriefing } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { briefing: XBriefing };
    const tweet = await generateTweet(body.briefing);
    return NextResponse.json({ tweet });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[generate-tweet] ${new Date().toISOString()} ${error}`);
    return NextResponse.json({ error }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { hasPosted, markPosted } from '@/lib/dedup';
import { postTweet } from '@/lib/twitter';
import type { XPosterSection } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const { tweet, briefingUrl, section, imageBase64 } = (await request.json()) as {
      tweet: string;
      briefingUrl: string;
      section: XPosterSection;
      imageBase64?: string;
    };

    const alreadyPosted = await hasPosted(section, briefingUrl);
    if (alreadyPosted) {
      return NextResponse.json({ error: 'already posted' }, { status: 409 });
    }

    const imageBuffer = imageBase64 ? Buffer.from(imageBase64, 'base64') : undefined;
    const result = await postTweet(tweet, imageBuffer);

    if (result.success) {
      await markPosted(section, briefingUrl);
    }

    return NextResponse.json(result);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[post-tweet] ${new Date().toISOString()} ${error}`);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
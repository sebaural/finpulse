import { NextRequest, NextResponse } from 'next/server';
import { hasPosted, markPosted } from '@/lib/dedup';
import { postTweet } from '@/lib/twitter';
import type { XPosterSection } from '@/types';
import { readFileSync } from 'fs';
import path from 'path';

const DEFAULT_IMAGE = path.join(process.cwd(), 'public/macrostance_X.png');

export async function POST(request: NextRequest) {
  try {
    const { tweet, briefingUrl, section, imageBase64 } = (await request.json()) as {
      tweet:        string;
      briefingUrl:  string;
      section:      XPosterSection;
      imageBase64?: string;
    };

    const alreadyPosted = await hasPosted(section, briefingUrl);
    if (alreadyPosted) {
      return NextResponse.json({ error: 'already posted' }, { status: 409 });
    }

    // Use provided image or fall back to default
    let mediaBuffer: Buffer | undefined;
    if (imageBase64) {
      mediaBuffer = Buffer.from(imageBase64, 'base64');
    } else {
      try {
        mediaBuffer = readFileSync(DEFAULT_IMAGE);
      } catch {
        console.warn('[post-tweet] Default image not found');
      }
    }

    const result = await postTweet(tweet, mediaBuffer);

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
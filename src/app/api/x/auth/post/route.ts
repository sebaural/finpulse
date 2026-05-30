import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/x-token';

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const accessToken = await getValidAccessToken();

    const response = await fetch('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ text }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: result }, { status: 400 });
    }

    return NextResponse.json({ success: true, tweet: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/seo';

const INDEXNOW_KEY = process.env.INDEXNOW_KEY;
const HOST = new URL(SITE_URL).hostname;

export async function POST(req: NextRequest) {
  if (!INDEXNOW_KEY) {
    return NextResponse.json(
      { error: 'INDEXNOW_KEY environment variable is not set' },
      { status: 500 },
    );
  }

  let body: { urls?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { urls } = body;

  if (!Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: 'urls must be a non-empty array' },
      { status: 400 },
    );
  }

  const invalid = urls.filter((u) => typeof u !== 'string' || !u.startsWith(SITE_URL));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `All URLs must belong to ${HOST}`, invalid },
      { status: 400 },
    );
  }

  const response = await fetch('https://api.indexnow.org/IndexNow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: HOST,
      key: INDEXNOW_KEY,
      keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
      urlList: urls,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json(
      { error: 'IndexNow submission failed', detail },
      { status: response.status },
    );
  }

  return NextResponse.json({ success: true, submitted: urls.length, urls });
}

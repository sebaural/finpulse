import { NextRequest, NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/seo';
import { submitToIndexNow } from '@/lib/indexnow';

const HOST = new URL(SITE_URL).hostname;

// Kept for external/manual triggering. Internal callers should use
// submitToIndexNow() from '@/lib/indexnow' directly instead of fetching this
// route — see the comment on that function for why.
export async function POST(req: NextRequest) {
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

  try {
    await submitToIndexNow(urls as string[]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({ success: true, submitted: urls.length, urls });
}

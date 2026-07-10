// src/app/api/macro/articles/route.ts
//
// Single-item lookup — NOT a list. This intentionally does not mirror the
// markets/pulse/tech `?page=&pageSize=` pagination contract: Macro Landscape
// always shows exactly one entry with Prev/Next stepping. See
// macro-landscape-feature-build-prompt.md §3.

import { NextRequest, NextResponse } from 'next/server';
import {
  buildMacroResponse,
  getLatestMacroArticle,
  getMacroArticleByDate,
  getMacroArticleBySlug,
} from '@/lib/macro-service';
import type { MacroArticle, MacroArticleResponse } from '@/types/macro';

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get('date');
    const slug = req.nextUrl.searchParams.get('slug');

    let article: MacroArticle | null;

    if (slug) {
      article = await getMacroArticleBySlug(slug);
    } else if (date) {
      if (!isIsoDate(date)) {
        return NextResponse.json({ error: 'Invalid date (expected YYYY-MM-DD)' }, { status: 400 });
      }
      article = await getMacroArticleByDate(date);
    } else {
      // No param → latest entry.
      article = await getLatestMacroArticle();
    }

    if (!article) {
      // No param + no rows means the archive is empty (not a 404); a param that
      // resolves to nothing is a genuine 404.
      if (!slug && !date) {
        return NextResponse.json<MacroArticleResponse>({ article: null, previous: null, next: null });
      }
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(await buildMacroResponse(article));
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to fetch article', details }, { status: 500 });
  }
}

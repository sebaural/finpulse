import 'server-only';
import type { GdeltSummaryResponse } from '@/types/pulse';

const GDELT_SUMMARY_URL = 'https://gdeltcloud.com/api/v2/stories';

export interface FetchPulseSummaryOptions {
  category: string;
  dateStart?: string;
  dateEnd?: string;
  limit?: number;
  sort?: string;
}

export async function fetchPulseSummary(
  options: FetchPulseSummaryOptions,
): Promise<GdeltSummaryResponse> {
  const apiKey = process.env.GDELT_API_KEY;
  if (!apiKey) {
    throw new Error('Missing GDELT_API_KEY environment variable');
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const yesterday = new Date(now);
  yesterday.setUTCDate(now.getUTCDate() - 1);
  const dayBefore = yesterday.toISOString().slice(0, 10);

  const dateStart = options.dateStart ?? dayBefore;
  const dateEnd = options.dateEnd ?? today;

  // /stories takes a flat story_category (not the old /events/summary
  // category+group_by+observed_start/end shape) — verified against a live
  // response on 2026-08-24.
  const params = new URLSearchParams();
  params.append('limit', String(options.limit ?? 10));
  params.append('date_start', dateStart);
  params.append('date_end', dateEnd);
  params.append('sort', options.sort ?? 'recent');
  params.append('story_category', options.category);

  const url = new URL(GDELT_SUMMARY_URL);
  url.search = params.toString();

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    // Surface the response body — GDELT returns a structured error (notably a
    // `QUOTA_EXCEEDED` code with the calendar-month reset time on the free
    // plan). Without it, a spent quota looks identical to any other outage and
    // is easy to misdiagnose as an application bug.
    const body = await res.text().catch(() => '');
    let detail = body.slice(0, 500);
    try {
      const parsed = JSON.parse(body) as { code?: string; error?: string };
      if (parsed.code || parsed.error) {
        detail = [parsed.code, parsed.error].filter(Boolean).join(': ');
      }
    } catch {
      /* body was not JSON — fall back to the raw text slice */
    }
    throw new Error(`GDELT API error: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`);
  }

  return (await res.json()) as GdeltSummaryResponse;
}

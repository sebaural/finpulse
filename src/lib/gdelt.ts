import 'server-only';
import type { GdeltSummaryResponse } from '@/types/pulse';

const GDELT_SUMMARY_URL = 'https://gdeltcloud.com/api/v2/stories';

export interface FetchPulseSummaryOptions {
  category: string;
  groupBy?: string;
  dateStart?: string;
  dateEnd?: string;
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

  const params = new URLSearchParams();
  params.append('date_start', dateStart);
  params.append('date_end', dateEnd);
  // GDELT now rejects observed_start/observed_end with a time component
  // ("INVALID_DATE: Invalid observed_start. Use a real calendar date
  // YYYY-MM-DD") — send plain calendar dates, same as date_start/date_end.
  params.append('observed_start', dateStart);
  params.append('observed_end', dateEnd);
  params.append('category', options.category);
  params.append('group_by', options.groupBy ?? 'date');

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

import 'server-only';
import type { GdeltSummaryResponse } from '@/types/pulse';

const GDELT_SUMMARY_URL = 'https://gdeltcloud.com/api/v2/events/summary';

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
  params.append('observed_start', `${dateStart}T00:00:00Z`);
  params.append('observed_end', `${dateEnd}T23:59:59Z`);
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
    throw new Error(`GDELT API error: HTTP ${res.status}`);
  }

  return (await res.json()) as GdeltSummaryResponse;
}

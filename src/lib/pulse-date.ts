import type { PulseArticle } from '@/types/pulse';

const PULSE_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function getPulseDisplayDateSource(article: Pick<PulseArticle, 'observedStart' | 'publishedAt'>): string | null {
  return article.observedStart ?? article.publishedAt ?? null;
}

export function formatPulseDisplayDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return PULSE_DATE_FORMATTER.format(parsed);
}
import type { PulseCategoryConfig, PulseSlug } from '@/types/pulse';

export const PULSE_CATEGORIES: Record<PulseSlug, PulseCategoryConfig> = {
  economy: {
    pulseSlug: 'economy',
    label: 'Economy',
    gdeltCategory: 'ECONOMIC',
  },
  information: {
    pulseSlug: 'information',
    label: 'Technology',
    gdeltCategory: 'TECHNOLOGY',
  },
  politics: {
    pulseSlug: 'politics',
    label: 'Politics',
    gdeltCategory: 'POLITICAL',
  },
  strategic: {
    pulseSlug: 'strategic',
    label: 'Strategic',
    gdeltCategory: 'Strategic developments',
  },
};

export const PULSE_SLUGS = Object.keys(PULSE_CATEGORIES) as PulseSlug[];

export function isPulseSlug(value: string): value is PulseSlug {
  return value in PULSE_CATEGORIES;
}

export function resolvePulseSlug(value: string): PulseSlug | null {
  if (!value) return null;

  const decoded = decodeURIComponent(value).trim();
  if (isPulseSlug(decoded)) return decoded;

  const segments = decoded.split('/').filter(Boolean);
  const last = segments.at(-1);
  if (last && isPulseSlug(last)) return last;

  return null;
}

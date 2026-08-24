import type { PulseCategoryConfig, PulseSlug } from '@/types/pulse';

// gdeltCategory values are GDELT's `story_category` values for the /stories
// endpoint (verified against a live response on 2026-08-24), e.g.
// "cameoplus_political". The old ECONOMIC/TECHNOLOGY/POLITICAL/"Strategic
// developments" strings were guesses for the prior /events/summary endpoint
// and never confirmed against a real response.
export const PULSE_CATEGORIES: Record<PulseSlug, PulseCategoryConfig> = {
  economy: {
    pulseSlug: 'economy',
    label: 'Economy',
    gdeltCategory: 'cameoplus_economic',
  },
  information: {
    pulseSlug: 'information',
    label: 'Technology',
    gdeltCategory: 'cameoplus_technology',
  },
  politics: {
    pulseSlug: 'politics',
    label: 'Politics',
    gdeltCategory: 'cameoplus_political',
  },
  strategic: {
    pulseSlug: 'strategic',
    label: 'Strategic',
    gdeltCategory: 'cameoplus_information',
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

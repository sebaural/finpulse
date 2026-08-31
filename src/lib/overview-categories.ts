// src/lib/overview-categories.ts
//
// Single source of truth for the 5 fixed Overview regions — consumed by LLM
// classification (overview-service.ts), the filter pills and block accent
// colors (components/overview/*), and Prisma's OverviewBlock.category values.
// Modeled on the existing PULSE_CATEGORIES pattern in lib/pulse-categories.ts.
// Accent colors are ported from the reference mockup.

export type OverviewCategorySlug = 'us' | 'east-asia' | 'middle-east' | 'europe' | 'africa';

export interface OverviewCategoryConfig {
  slug: OverviewCategorySlug;
  label: string;
  accent: string;
}

export const OVERVIEW_CATEGORIES: Record<OverviewCategorySlug, OverviewCategoryConfig> = {
  us: { slug: 'us', label: 'U.S.', accent: '#5b9bd5' },
  'east-asia': { slug: 'east-asia', label: 'East Asia', accent: '#d9534f' },
  'middle-east': { slug: 'middle-east', label: 'Middle East', accent: '#d4943c' },
  europe: { slug: 'europe', label: 'Europe', accent: '#9b7fd4' },
  africa: { slug: 'africa', label: 'Africa', accent: '#3dbcaf' },
};

export const OVERVIEW_CATEGORY_SLUGS = Object.keys(
  OVERVIEW_CATEGORIES
) as OverviewCategorySlug[];

export function isOverviewCategorySlug(value: string): value is OverviewCategorySlug {
  return value in OVERVIEW_CATEGORIES;
}

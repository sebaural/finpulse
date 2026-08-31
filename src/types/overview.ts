import type { OverviewCategorySlug } from '@/lib/overview-categories';

export interface OverviewBlockView {
  id: string;
  category: OverviewCategorySlug;
  title: string;
  description: string;
  summary: string;
}

export interface OverviewDayView {
  id: string;
  dateLabel: string;
  isToday: boolean;
  context: string | null;
  blocks: OverviewBlockView[];
}

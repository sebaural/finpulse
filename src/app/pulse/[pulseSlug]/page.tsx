import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PulsePageClient } from '@/components/pulse/PulsePageClient';
import { PULSE_CATEGORIES, PULSE_SLUGS, resolvePulseSlug } from '@/lib/pulse-categories';
import { getPulseArticles } from '@/lib/pulse-service';
import { buildMetadata } from '@/lib/seo';

interface PulsePageProps {
  params: Promise<{ pulseSlug: string }>;
}

export async function generateMetadata({ params }: PulsePageProps): Promise<Metadata> {
  const { pulseSlug: rawPulseSlug } = await params;
  const pulseSlug = resolvePulseSlug(rawPulseSlug);
  if (!pulseSlug) {
    return {};
  }

  const config = PULSE_CATEGORIES[pulseSlug];

  return buildMetadata({
    title: `${config.label} Pulse — Daily Intelligence Feed`,
    description: `MacroStance ${config.label.toLowerCase()} pulse with continuously refreshed intelligence briefs generated from global event signals.`,
    path: `/pulse/${pulseSlug}`,
    ogTitle: `${config.label} Pulse | MacroStance`,
    ogDescription: `Track the latest ${config.label.toLowerCase()} pulse developments and related intelligence briefings.`,
  });
}

export default async function PulsePage({ params }: PulsePageProps) {
  const { pulseSlug: rawPulseSlug } = await params;
  const pulseSlug = resolvePulseSlug(rawPulseSlug);
  if (!pulseSlug) notFound();

  const config = PULSE_CATEGORIES[pulseSlug];
  const articles = await getPulseArticles(pulseSlug);

  return <PulsePageClient config={config} articles={articles} />;
}

export function generateStaticParams() {
  return PULSE_SLUGS.map((pulseSlug) => ({ pulseSlug }));
}

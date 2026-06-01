import { redis } from '@/lib/redis';
import type { XPosterSection } from '@/types';

const kvKey = (section: XPosterSection) => `macrostance:lastPostedUrl:${section}`;

export async function hasPosted(section: XPosterSection, url: string): Promise<boolean> {
  const stored = await redis.get<string>(kvKey(section));
  return stored === url;
}

export async function markPosted(section: XPosterSection, url: string): Promise<void> {
  await redis.set(kvKey(section), url);
}

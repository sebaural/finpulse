import { getRedis } from '@/lib/redis';
import type { XPosterSection } from '@/types';

const kvKey = (section: XPosterSection) => `macrostance:lastPostedUrl:${section}`;

export async function hasPosted(section: XPosterSection, url: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) {
    return false;
  }

  const stored = await redis.get<string>(kvKey(section));
  return stored === url;
}

export async function markPosted(section: XPosterSection, url: string): Promise<void> {
  const redis = getRedis();
  if (!redis) {
    return;
  }

  await redis.set(kvKey(section), url);
}
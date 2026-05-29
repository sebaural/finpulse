import { kv } from './tokens';
import type { XPosterSection } from '@/types';

const kvKey = (section: XPosterSection) => `macrostance:lastPostedUrl:${section}`;

export async function hasPosted(section: XPosterSection, url: string): Promise<boolean> {
  const stored = await kv.get<string>(kvKey(section));
  return stored === url;
}

export async function markPosted(section: XPosterSection, url: string): Promise<void> {
  await kv.set(kvKey(section), url);
}

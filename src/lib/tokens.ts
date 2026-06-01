import { redis } from '@/lib/redis';
import type { XStoredTokens } from '@/types';

export async function saveTokens(tokens: XStoredTokens): Promise<void> {
  await redis.set('x_tokens', JSON.stringify(tokens));
}

export async function getStoredTokens(): Promise<XStoredTokens> {
  const raw = await redis.get<string>('x_tokens');
  if (!raw) throw new Error('No x_tokens found — run /api/x-poster/authorize first');
  return typeof raw === 'string' ? JSON.parse(raw) : (raw as XStoredTokens);
}

export { redis };

import { getRedis } from '@/lib/redis';
import type { XStoredTokens } from '@/types';

const TOKENS_KEY = 'x_tokens';

export async function saveTokens(tokens: XStoredTokens): Promise<void> {
  const redis = getRedis();

  if (!redis) {
    throw new Error('Redis is not configured');
  }

  await redis.set(TOKENS_KEY, JSON.stringify(tokens));
}

export async function getStoredTokens(): Promise<XStoredTokens> {
  const redis = getRedis();

  if (!redis) {
    throw new Error('Redis is not configured');
  }

  const raw = await redis.get<string>(TOKENS_KEY);

  if (!raw) {
    throw new Error('No x_tokens found — run /api/x-poster/authorize first');
  }

  return typeof raw === 'string' ? JSON.parse(raw) : (raw as XStoredTokens);
}
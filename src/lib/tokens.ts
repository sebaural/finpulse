import { createClient } from '@vercel/kv';
import type { XStoredTokens } from '@/types';

const kv = createClient({
  url:   process.env.FINPULSE_KV_REST_API_URL!,
  token: process.env.FINPULSE_KV_REST_API_TOKEN!,
});

export async function saveTokens(tokens: XStoredTokens): Promise<void> {
  await kv.set('x_tokens', JSON.stringify(tokens));
}

export async function getStoredTokens(): Promise<XStoredTokens> {
  const raw = await kv.get<string>('x_tokens');
  if (!raw) throw new Error('No x_tokens found — run /api/x-poster/authorize first');
  return typeof raw === 'string' ? JSON.parse(raw) : (raw as XStoredTokens);
}

export { kv };

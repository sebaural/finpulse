import { Redis } from '@upstash/redis';

export function getRedis() {
  const url = process.env.FINPULSE_KV_REST_API_URL;
  const token = process.env.FINPULSE_KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({ url, token });
}
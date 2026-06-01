import { Redis } from '@upstash/redis';

// Ensure variables are defined for TypeScript safety
if (!process.env.FINPULSE_KV_REST_API_URL || !process.env.FINPULSE_KV_REST_API_TOKEN) {
  throw new Error('Missing Redis environment variables');
}

export const redis = new Redis({
  url: process.env.FINPULSE_KV_REST_API_URL,
  token: process.env.FINPULSE_KV_REST_API_TOKEN,
});
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.FINPULSE_KV_REST_API_URL!,
  token: process.env.FINPULSE_KV_REST_API_TOKEN!,
});

// 5 submissions per 10 minutes per IP
export const contactRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '10 m'),
  analytics: true,
  prefix: 'macrostance:contact',
});

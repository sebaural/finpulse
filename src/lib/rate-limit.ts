import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type RateLimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
};

function getContactRateLimit(): Ratelimit | null {
  const url = process.env.FINPULSE_KV_REST_API_URL;
  const token = process.env.FINPULSE_KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  const redis = new Redis({ url, token });

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '10 m'),
    analytics: true,
    prefix: 'macrostance:contact',
  });
}

export const contactRateLimit = {
  async limit(identifier: string): Promise<RateLimitResult> {
    const ratelimit = getContactRateLimit();

    if (!ratelimit) {
      return {
        success: true,
        remaining: 5,
        reset: Date.now() + 10 * 60 * 1000,
      };
    }

    const result = await ratelimit.limit(identifier);

    return {
      success: result.success,
      remaining: result.remaining,
      reset: result.reset,
    };
  },
};
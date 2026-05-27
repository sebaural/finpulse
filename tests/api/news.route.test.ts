import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/news', () => ({
  getAggregatedNews: vi.fn(),
}));

import { GET } from '@/app/api/news/route';
import { getAggregatedNews } from '@/server/news';

describe('/api/news route', () => {
  it('returns live response headers when provider is live', async () => {
    vi.mocked(getAggregatedNews).mockResolvedValueOnce({
      articles: [],
      usingFallback: false,
      provider: 'newsapi',
      fromCache: true,
      status: 'live',
      warnings: [],
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ articles: [], usingFallback: false });
    expect(response.headers.get('X-Provider-Status')).toBe('live');
    expect(response.headers.get('X-Cache')).toBe('HIT');
  });

  it('returns fallback headers when providers fail', async () => {
    vi.mocked(getAggregatedNews).mockResolvedValueOnce({
      articles: [],
      usingFallback: true,
      provider: 'fallback-demo',
      fromCache: false,
      status: 'fallback',
      warnings: ['newsapi: timeout'],
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ articles: [], usingFallback: true });
    expect(response.headers.get('X-Provider-Status')).toBe('fallback');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });
});

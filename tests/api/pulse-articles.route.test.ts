import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/pulse-service', () => ({
  getPulseArticles: vi.fn(),
  getLatestArticlePerCategory: vi.fn(),
}));

import { GET } from '@/app/api/pulse/articles/route';
import { getLatestArticlePerCategory, getPulseArticles } from '@/lib/pulse-service';

function request(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

describe('/api/pulse/articles route', () => {
  it('returns category list for a valid pulseSlug', async () => {
    const article = {
      pulseSlug: 'economy' as const,
      articleSlug: 'rates-growth-outlook',
      title: 'Rates and Growth Outlook',
      summary: 'Summary',
      body: 'Body',
      sourceUrl: 'https://example.com',
      category: 'ECONOMIC',
      observedStart: '2026-07-01T00:00:00.000Z',
      observedEnd: '2026-07-02T00:00:00.000Z',
      publishedAt: '2026-07-02T10:00:00.000Z',
      raw: { row: 1 },
    };

    vi.mocked(getPulseArticles).mockResolvedValueOnce([article]);

    const response = await GET(request('https://macrostance.com/api/pulse/articles?pulseSlug=economy'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: [article] });
  });

  it('returns latest map when pulseSlug is omitted', async () => {
    vi.mocked(getLatestArticlePerCategory).mockResolvedValueOnce({
      economy: null,
      information: null,
      politics: null,
      strategic: null,
    });

    const response = await GET(request('https://macrostance.com/api/pulse/articles'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toHaveProperty('economy');
    expect(body.data).toHaveProperty('information');
    expect(body.data).toHaveProperty('politics');
    expect(body.data).toHaveProperty('strategic');
  });

  it('returns 400 for invalid pulseSlug', async () => {
    const response = await GET(request('https://macrostance.com/api/pulse/articles?pulseSlug=unknown'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: 'Invalid pulseSlug' });
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/geopolitics-service', () => ({
  getSummaryArticles: vi.fn(),
}));

import { GET } from '@/app/api/geopolitics/articles/route';
import { getSummaryArticles } from '@/lib/geopolitics-service';

describe('/api/geopolitics/articles route', () => {
  it('returns articles payload from the service', async () => {
    const article = {
      id: 'a1',
      title: 'Headline',
      slug: 'headline',
      summary: 'Summary',
      keyPoints: ['k1'],
      sourceArticles: [],
      region: 'Global',
      tags: ['tag'],
      date: '2026-01-01',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    };

    vi.mocked(getSummaryArticles).mockResolvedValueOnce([article]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      articles: [{ ...article, createdAt: article.createdAt.toISOString() }],
    });
  });

  it('returns 500 when service throws', async () => {
    vi.mocked(getSummaryArticles).mockRejectedValueOnce(new Error('db down'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to fetch articles');
    expect(body.details).toContain('db down');
  });
});

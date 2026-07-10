import { describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/macro-service', () => ({
  getLatestMacroArticle: vi.fn(),
  getMacroArticleByDate: vi.fn(),
  getMacroArticleBySlug: vi.fn(),
  buildMacroResponse: vi.fn(),
  runDailyMacroPipeline: vi.fn(),
}));

// Lightweight stand-in for the cron helpers so the generate route can be tested
// without importing the full unified-pipeline module graph. Mirrors the real
// runCronPipeline behavior (success → {success, article}; throw → 500).
vi.mock('@/server/cron', () => ({
  isCronAuthorized: () => true,
  runCronPipeline: async (fn: () => Promise<unknown>) => {
    try {
      const article = await fn();
      return NextResponse.json({ success: true, article });
    } catch (err) {
      const details = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: 'Pipeline failed', details }, { status: 500 });
    }
  },
}));

import { GET } from '@/app/api/macro/articles/route';
import { GET as GENERATE_GET } from '@/app/api/macro/generate/route';
import {
  buildMacroResponse,
  getLatestMacroArticle,
  getMacroArticleByDate,
  getMacroArticleBySlug,
  runDailyMacroPipeline,
} from '@/lib/macro-service';

function request(url: string): NextRequest {
  return new NextRequest(url, { method: 'GET' });
}

function makeArticle(publishedDate: string) {
  return {
    id: `id-${publishedDate}`,
    slug: `macro-landscape-${publishedDate}`,
    title: `The Macro Landscape — ${publishedDate}`,
    publishedDate,
    body: '<h2>Overview</h2><p>Body</p>',
    createdAt: new Date('2026-07-10T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T00:00:00.000Z'),
  };
}

const BASE = 'https://macrostance.com/api/macro/articles';

describe('/api/macro/articles route', () => {
  it('returns the latest entry with next: null when no param is given', async () => {
    const latest = makeArticle('2026-07-10');
    vi.mocked(getLatestMacroArticle).mockResolvedValueOnce(latest);
    vi.mocked(buildMacroResponse).mockResolvedValueOnce({
      article: {
        title: latest.title,
        slug: latest.slug,
        publishedDate: latest.publishedDate,
        body: latest.body,
      },
      previous: { slug: 'macro-landscape-2026-07-09', publishedDate: '2026-07-09' },
      next: null,
    });

    const response = await GET(request(BASE));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.article.slug).toBe('macro-landscape-2026-07-10');
    expect(body.previous).not.toBeNull();
    expect(body.next).toBeNull();
  });

  it('returns correct previous/next adjacency for a middle date', async () => {
    const mid = makeArticle('2026-07-08');
    vi.mocked(getMacroArticleByDate).mockResolvedValueOnce(mid);
    vi.mocked(buildMacroResponse).mockResolvedValueOnce({
      article: {
        title: mid.title,
        slug: mid.slug,
        publishedDate: mid.publishedDate,
        body: mid.body,
      },
      previous: { slug: 'macro-landscape-2026-07-07', publishedDate: '2026-07-07' },
      next: { slug: 'macro-landscape-2026-07-09', publishedDate: '2026-07-09' },
    });

    const response = await GET(request(`${BASE}?date=2026-07-08`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.previous.publishedDate).toBe('2026-07-07');
    expect(body.next.publishedDate).toBe('2026-07-09');
  });

  it('returns previous: null for the oldest entry', async () => {
    const oldest = makeArticle('2026-07-01');
    vi.mocked(getMacroArticleByDate).mockResolvedValueOnce(oldest);
    vi.mocked(buildMacroResponse).mockResolvedValueOnce({
      article: {
        title: oldest.title,
        slug: oldest.slug,
        publishedDate: oldest.publishedDate,
        body: oldest.body,
      },
      previous: null,
      next: { slug: 'macro-landscape-2026-07-02', publishedDate: '2026-07-02' },
    });

    const response = await GET(request(`${BASE}?date=2026-07-01`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.previous).toBeNull();
    expect(body.next).not.toBeNull();
  });

  it('returns 404 for an unknown date', async () => {
    vi.mocked(getMacroArticleByDate).mockResolvedValueOnce(null);

    const response = await GET(request(`${BASE}?date=1999-01-01`));
    expect(response.status).toBe(404);
  });

  it('returns 404 for an unknown slug', async () => {
    vi.mocked(getMacroArticleBySlug).mockResolvedValueOnce(null);

    const response = await GET(request(`${BASE}?slug=does-not-exist`));
    expect(response.status).toBe(404);
  });

  it('returns 400 for a malformed date param', async () => {
    const response = await GET(request(`${BASE}?date=not-a-date`));
    expect(response.status).toBe(400);
  });
});

describe('/api/macro/generate route', () => {
  it('rejects (500) when generation is missing one of the four output keys', async () => {
    vi.mocked(runDailyMacroPipeline).mockRejectedValueOnce(
      new Error('Macro generation missing required key(s): body'),
    );

    const response = await GENERATE_GET(
      request('https://macrostance.com/api/macro/generate'),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Pipeline failed');
    expect(body.details).toContain('missing required key');
  });
});

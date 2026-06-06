import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('X OAuth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('builds an authorization code exchange request with basic auth', async () => {
    vi.stubEnv('X_CLIENT_ID', 'client-id');
    vi.stubEnv('X_CLIENT_SECRET', 'client-secret');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'access-1',
          refresh_token: 'refresh-1',
          expires_in: 7200,
          token_type: 'bearer',
          scope: 'tweet.write',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const { exchangeCodeForTokens, generateCodeChallenge, generateCodeVerifier } = await import('@/lib/x-oauth');
    const verifier = generateCodeVerifier();

    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(generateCodeChallenge('plain-verifier')).toMatch(/^[A-Za-z0-9_-]+$/);

    const result = await exchangeCodeForTokens(
      'auth-code',
      'plain-verifier',
      'https://macrostance.com/api/x-poster/callback',
    );

    expect(result.access_token).toBe('access-1');
    expect(fetch).toHaveBeenCalledWith('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'auth-code',
        client_id: 'client-id',
        redirect_uri: 'https://macrostance.com/api/x-poster/callback',
        code_verifier: 'plain-verifier',
      }),
    });
  });

  it('refreshes a token with the refresh-token grant', async () => {
    vi.stubEnv('X_CLIENT_ID', 'client-id');
    vi.stubEnv('X_CLIENT_SECRET', 'client-secret');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          access_token: 'access-2',
          refresh_token: 'refresh-2',
          expires_in: 3600,
          token_type: 'bearer',
          scope: 'tweet.write offline.access',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const { refreshXToken } = await import('@/lib/x-oauth');
    const result = await refreshXToken('stored-refresh');

    expect(result.refresh_token).toBe('refresh-2');
    expect(fetch).toHaveBeenCalledWith('https://api.x.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: 'stored-refresh',
        client_id: 'client-id',
      }),
    });
  });
});

describe('X token storage and posting flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('saves tokens while preserving an existing refresh token when X omits it', async () => {
    const findUnique = vi.fn().mockResolvedValueOnce({ xRefreshToken: 'stored-refresh' });
    const upsert = vi.fn().mockResolvedValueOnce(undefined);

    vi.doMock('@/lib/db', () => ({
      prisma: {
        user: {
          findUnique,
          upsert,
        },
      },
    }));

    const { saveXTokens } = await import('@/lib/x-token');
    await saveXTokens({
      access_token: 'new-access',
      expires_in: 3600,
      token_type: 'bearer',
      scope: 'tweet.write',
    });

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'uralsebastian' },
      select: { xRefreshToken: true },
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'uralsebastian' },
        update: expect.objectContaining({
          xAccessToken: 'new-access',
          xRefreshToken: 'stored-refresh',
        }),
        create: expect.objectContaining({
          id: 'uralsebastian',
          email: 'uralsebastian@local.invalid',
          xAccessToken: 'new-access',
          xRefreshToken: 'stored-refresh',
        }),
      }),
    );
  });

  it('refreshes an expired access token and returns the new token', async () => {
    const findUnique = vi.fn().mockResolvedValueOnce({
      xAccessToken: 'expired-access',
      xRefreshToken: 'stored-refresh',
      xTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    const upsert = vi.fn().mockResolvedValueOnce(undefined);
    const refreshXToken = vi.fn().mockResolvedValueOnce({
      access_token: 'fresh-access',
      refresh_token: 'fresh-refresh',
      expires_in: 7200,
      token_type: 'bearer',
      scope: 'tweet.write offline.access',
    });

    vi.doMock('@/lib/db', () => ({
      prisma: {
        user: {
          findUnique,
          upsert,
        },
      },
    }));

    vi.doMock('@/lib/x-oauth', () => ({
      refreshXToken,
    }));

    const { getValidAccessToken } = await import('@/lib/x-token');
    const token = await getValidAccessToken();

    expect(token).toBe('fresh-access');
    expect(refreshXToken).toHaveBeenCalledWith('stored-refresh');
    expect(upsert).toHaveBeenCalledOnce();
  });

  it('refreshes and persists stored tokens through refreshStoredXToken', async () => {
    const findUnique = vi.fn().mockResolvedValueOnce({ xRefreshToken: 'stored-refresh' });
    const upsert = vi.fn().mockResolvedValueOnce(undefined);
    const refreshXToken = vi.fn().mockResolvedValueOnce({
      access_token: 'fresh-access',
      refresh_token: 'fresh-refresh',
      expires_in: 7200,
      token_type: 'bearer',
      scope: 'tweet.write offline.access',
    });

    vi.doMock('@/lib/db', () => ({
      prisma: {
        user: {
          findUnique,
          upsert,
        },
      },
    }));

    vi.doMock('@/lib/x-oauth', () => ({
      refreshXToken,
    }));

    const { refreshStoredXToken } = await import('@/lib/x-token');
    const result = await refreshStoredXToken();

    expect(result.accessToken).toBe('fresh-access');
    expect(result.expiresAt).toMatch(/Z$/);
    expect(upsert).toHaveBeenCalledOnce();
  });

  it('uploads media and creates a tweet through the X client helper', async () => {
    vi.doMock('@/lib/x-token', () => ({
      getValidAccessToken: vi.fn().mockResolvedValue('access-token'),
    }));

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 'media-1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 'tweet-9' } }), {
          status: 201,
          headers: { 'content-type': 'application/json' },
        }),
      );

    const { postTweet } = await import('@/lib/twitter');
    const result = await postTweet('MacroStance charts', Buffer.from('png-bytes'));

    expect(result).toEqual({ success: true, tweetId: 'tweet-9' });
    expect(fetch).toHaveBeenNthCalledWith(1, 'https://api.x.com/2/media/upload', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media: {
          media: Buffer.from('png-bytes').toString('base64'),
          media_type: 'image/png',
        },
      }),
    });
    expect(fetch).toHaveBeenNthCalledWith(2, 'https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer access-token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: 'MacroStance charts', media: { media_ids: ['media-1'] } }),
    });
  });

  it('runs the cron posting pipeline end to end for an unpublished markets briefing', async () => {
    vi.doMock('@/lib/markets-service', () => ({
      getMarketsSummaryArticles: vi.fn().mockResolvedValue([
        {
          title: 'Markets wrap',
          slug: 'markets-wrap',
          summary: 'Equities rose into the close.',
          keyPoints: ['Treasury yields eased'],
          date: '2026-06-06',
        },
      ]),
    }));
    vi.doMock('@/lib/geopolitics-service', () => ({
      getSummaryArticles: vi.fn().mockResolvedValue([]),
    }));
    vi.doMock('@/lib/tech-service', () => ({
      getTechSummaryArticles: vi.fn().mockResolvedValue([]),
    }));
    const hasPosted = vi
      .fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(true);
    const markPosted = vi.fn().mockResolvedValue(undefined);
    const generateTweet = vi.fn().mockResolvedValue('Markets tweet text');
    const postTweet = vi.fn().mockResolvedValue({ success: true, tweetId: 'tweet-77' });
    const readFileSync = vi.fn().mockReturnValue(Buffer.from('default-image'));

    vi.doMock('@/lib/dedup', () => ({
      hasPosted,
      markPosted,
    }));
    vi.doMock('@/lib/claude', () => ({
      generateTweet,
    }));
    vi.doMock('@/lib/twitter', () => ({
      postTweet,
    }));
    vi.doMock('fs', () => ({
      readFileSync,
    }));

    const { runXPosterPipeline } = await import('@/server/cron');
    const result = await runXPosterPipeline();

    expect(result).toEqual([
      { section: 'markets', success: true, tweetId: 'tweet-77' },
      { section: 'geopolitics', success: false, error: 'No articles found' },
      { section: 'tech', success: false, error: 'No articles found' },
    ]);
    expect(generateTweet).toHaveBeenCalledWith({
      section: 'markets',
      title: 'Markets wrap',
      url: 'https://macrostance.com/markets/markets-wrap',
      date: '2026-06-06',
      bodyText: 'Equities rose into the close.\nTreasury yields eased',
    });
    expect(postTweet).toHaveBeenCalledWith('Markets tweet text', Buffer.from('default-image'));
    expect(markPosted).toHaveBeenCalledWith('markets', 'https://macrostance.com/markets/markets-wrap');
    expect(readFileSync).toHaveBeenCalledOnce();
  });
});
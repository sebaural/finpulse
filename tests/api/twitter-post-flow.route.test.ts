import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  generateTweet: vi.fn(),
  hasPosted: vi.fn(),
  markPosted: vi.fn(),
  postTweet: vi.fn(),
  runXPosterPipeline: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  generateCodeVerifier: vi.fn(() => 'verifier-123'),
  generateCodeChallenge: vi.fn(() => 'challenge-456'),
  saveXTokens: vi.fn(),
  refreshStoredXToken: vi.fn(),
  clearXTokens: vi.fn(),
  getValidAccessToken: vi.fn(),
}));

vi.mock('@/lib/claude', () => ({
  generateTweet: routeMocks.generateTweet,
}));

vi.mock('@/lib/dedup', () => ({
  hasPosted: routeMocks.hasPosted,
  markPosted: routeMocks.markPosted,
}));

vi.mock('@/lib/twitter', () => ({
  postTweet: routeMocks.postTweet,
}));

vi.mock('@/server/cron', () => ({
  runXPosterPipeline: routeMocks.runXPosterPipeline,
}));

vi.mock('@/lib/x-oauth', () => ({
  exchangeCodeForTokens: routeMocks.exchangeCodeForTokens,
  generateCodeVerifier: routeMocks.generateCodeVerifier,
  generateCodeChallenge: routeMocks.generateCodeChallenge,
}));

vi.mock('@/lib/x-token', () => ({
  saveXTokens: routeMocks.saveXTokens,
  refreshStoredXToken: routeMocks.refreshStoredXToken,
  clearXTokens: routeMocks.clearXTokens,
  getValidAccessToken: routeMocks.getValidAccessToken,
}));

import { GET as cronGet } from '@/app/api/cron/route';
import { POST as generateTweetPost } from '@/app/api/generate-tweet/route';
import { POST as postTweetPost } from '@/app/api/post-tweet/route';
import { GET as xAuthGet } from '@/app/api/x/auth/route';
import { POST as xAuthPost } from '@/app/api/x/auth/post/route';
import { GET as xPosterAuthorizeGet } from '@/app/api/x-poster/authorize/route';
import { GET as xPosterCallbackGet } from '@/app/api/x-poster/callback/route';
import { POST as xPosterLogoutPost } from '@/app/api/x-poster/logout/route';
import { POST as xPosterRefreshPost } from '@/app/api/x-poster/refresh/route';
import { GET as xPosterStartGet } from '@/app/api/x-poster/start/route';

function makeJsonRequest(url: string, body: unknown, init?: RequestInit): NextRequest {
  const { headers: initHeaders, signal, ...rest } = init ?? {};

  return new NextRequest(url, {
    ...rest,
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(initHeaders ?? {}) },
    body: JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
}

describe('X posting route flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('generates a tweet draft from the briefing route', async () => {
    routeMocks.generateTweet.mockResolvedValueOnce('Markets moving on rate-cut hopes');

    const request = makeJsonRequest('https://macrostance.com/api/generate-tweet', {
      briefing: {
        section: 'markets',
        title: 'Daily markets wrap',
        url: 'https://macrostance.com/markets/daily-wrap',
        date: '2026-06-06',
        bodyText: 'Risk assets advanced after softer data.',
      },
    });

    const response = await generateTweetPost(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ tweet: 'Markets moving on rate-cut hopes' });
    expect(routeMocks.generateTweet).toHaveBeenCalledOnce();
  });

  it('posts a tweet and records dedup state through the post route', async () => {
    routeMocks.hasPosted.mockResolvedValueOnce(false);
    routeMocks.postTweet.mockResolvedValueOnce({ success: true, tweetId: 'tweet-42' });

    const request = makeJsonRequest('https://macrostance.com/api/post-tweet', {
      tweet: 'Geopolitics briefing now live',
      briefingUrl: 'https://macrostance.com/geopolitics/briefing',
      section: 'geopolitics',
      imageBase64: Buffer.from('image-bytes').toString('base64'),
    });

    const response = await postTweetPost(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true, tweetId: 'tweet-42' });
    expect(routeMocks.hasPosted).toHaveBeenCalledWith('geopolitics', 'https://macrostance.com/geopolitics/briefing');
    expect(routeMocks.postTweet).toHaveBeenCalledWith(
      'Geopolitics briefing now live',
      Buffer.from('image-bytes'),
    );
    expect(routeMocks.markPosted).toHaveBeenCalledWith('geopolitics', 'https://macrostance.com/geopolitics/briefing');
  });

  it('guards the cron route with the configured bearer token', async () => {
    vi.stubEnv('CRON_SECRET', 'secret-value');

    const unauthorized = await cronGet(new NextRequest('https://macrostance.com/api/cron'));

    expect(unauthorized.status).toBe(401);
    await expect(unauthorized.json()).resolves.toEqual({ error: 'Unauthorized' });

    routeMocks.runXPosterPipeline.mockResolvedValueOnce([
      { section: 'markets', success: true, tweetId: 'tweet-1' },
    ]);

    const authorized = await cronGet(
      new NextRequest('https://macrostance.com/api/cron', {
        headers: { authorization: 'Bearer secret-value' },
      }),
    );

    expect(authorized.status).toBe(200);
    await expect(authorized.json()).resolves.toEqual({
      results: [{ section: 'markets', success: true, tweetId: 'tweet-1' }],
    });
  });

  it('redirects the x-poster start route to X with PKCE cookie state', async () => {
    vi.stubEnv('X_CLIENT_ID', 'client-id');

    const response = await xPosterStartGet(
      new NextRequest('https://macrostance.com/api/x-poster/start'),
    );

    expect(response.status).toBe(307);
    const location = response.headers.get('location');
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(location).toContain('https://x.com/i/oauth2/authorize');
    expect(location).toContain('client_id=client-id');
    expect(location).toContain('scope=tweet.read+tweet.write+users.read+offline.access');
    expect(setCookie).toContain('x_oauth=');
  });

  it('redirects the authorize route to X and stores oauth state in a cookie', async () => {
    vi.stubEnv('X_CLIENT_ID', 'client-id');
    vi.stubEnv('X_REDIRECT_URI', 'https://macrostance.com/api/x-poster/callback');

    const response = await xPosterAuthorizeGet();
    const location = response.headers.get('location') ?? '';
    const setCookie = response.headers.get('set-cookie') ?? '';

    expect(response.status).toBe(307);
    expect(location).toContain('https://x.com/i/oauth2/authorize');
    expect(location).toContain('code_challenge=challenge-456');
    expect(location).toContain('scope=tweet.read+tweet.write+users.read+offline.access+media.write');
    expect(setCookie).toContain('x_oauth=');
    expect(routeMocks.generateCodeVerifier).toHaveBeenCalledOnce();
    expect(routeMocks.generateCodeChallenge).toHaveBeenCalledWith('verifier-123');
  });

  it('exchanges the callback code, saves tokens, and redirects back to the dashboard', async () => {
    vi.stubEnv('X_REDIRECT_URI', 'https://macrostance.com/api/x-poster/callback');
    routeMocks.exchangeCodeForTokens.mockResolvedValueOnce({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      expires_in: 7200,
      token_type: 'bearer',
      scope: 'tweet.write offline.access',
    });

    const oauthCookie = encodeURIComponent(
      JSON.stringify({ codeVerifier: 'verifier-123', state: 'state-abc' }),
    );

    const response = await xPosterCallbackGet(
      new NextRequest(
        'https://macrostance.com/api/x-poster/callback?code=code-1&state=state-abc',
        {
          headers: { cookie: `x_oauth=${oauthCookie}` },
        },
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://macrostance.com/dashboard?x=connected');
    expect(routeMocks.exchangeCodeForTokens).toHaveBeenCalledWith(
      'code-1',
      'verifier-123',
      'https://macrostance.com/api/x-poster/callback',
    );
    expect(routeMocks.saveXTokens).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: 'new-access', refresh_token: 'new-refresh' }),
    );
    expect(response.headers.get('set-cookie')).toContain('x_oauth=;');
  });

  it('refreshes the stored X token through the refresh route', async () => {
    routeMocks.refreshStoredXToken.mockResolvedValueOnce({
      accessToken: 'fresh-access',
      expiresAt: '2026-06-06T12:00:00.000Z',
    });

    const response = await xPosterRefreshPost();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      expiresAt: '2026-06-06T12:00:00.000Z',
    });
  });

  it('clears stored tokens and oauth cookies on logout', async () => {
    const response = await xPosterLogoutPost(
      new NextRequest('https://macrostance.com/api/x-poster/logout', { method: 'POST' }),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://macrostance.com/dashboard');
    expect(routeMocks.clearXTokens).toHaveBeenCalledOnce();
    expect(response.headers.get('set-cookie')).toContain('x_oauth=;');
  });

  it('redirects the legacy x auth route to the x-poster authorize route', async () => {
    const response = await xAuthGet(new NextRequest('https://macrostance.com/api/x/auth'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://macrostance.com/api/x-poster/authorize');
  });

  it('posts directly to X through the authenticated post route', async () => {
    routeMocks.getValidAccessToken.mockResolvedValueOnce('access-token');
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { id: 'tweet-500' } }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await xAuthPost(
      makeJsonRequest('https://macrostance.com/api/x/auth/post', {
        text: 'MacroStance tweet',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      tweet: { data: { id: 'tweet-500' } },
    });
    expect(routeMocks.getValidAccessToken).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith('https://api.x.com/2/tweets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer access-token',
      },
      body: JSON.stringify({ text: 'MacroStance tweet' }),
    });
  });
});
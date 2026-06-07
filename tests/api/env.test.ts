import { describe, expect, it, vi, afterEach } from 'vitest';

describe('news provider env — no-secrets CI safety', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('does not throw when all news provider keys are absent in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('NEWSAPI_KEY', '');
    vi.stubEnv('GNEWS_API_KEY', '');
    vi.stubEnv('ALPHAVANTAGE_API_KEY', '');
    vi.stubEnv('FMP_API_KEY', '');
    vi.stubEnv('MARKETAUX_KEY', '');
    vi.stubEnv('FINNHUB_KEY', '');
    vi.stubEnv('X_RAPIDAPI_KEY', '');
    vi.stubEnv('TIINGO_API_KEY', '');

    await expect(import('@/lib/env')).resolves.toBeDefined();
  });

  it('hasNewsProviderKeys returns false when all keys are empty', async () => {
    vi.stubEnv('NEWSAPI_KEY', '');
    vi.stubEnv('GNEWS_API_KEY', '');
    vi.stubEnv('ALPHAVANTAGE_API_KEY', '');
    vi.stubEnv('FMP_API_KEY', '');
    vi.stubEnv('MARKETAUX_KEY', '');
    vi.stubEnv('FINNHUB_KEY', '');
    vi.stubEnv('X_RAPIDAPI_KEY', '');
    vi.stubEnv('TIINGO_API_KEY', '');

    vi.resetModules();
    const { hasNewsProviderKeys } = await import('@/lib/env');
    expect(hasNewsProviderKeys()).toBe(false);
  });

  it('hasNewsProviderKeys returns true when at least one key is set', async () => {
    vi.stubEnv('NEWSAPI_KEY', 'test-key-abc');
    vi.stubEnv('GNEWS_API_KEY', '');
    vi.stubEnv('ALPHAVANTAGE_API_KEY', '');
    vi.stubEnv('FMP_API_KEY', '');
    vi.stubEnv('MARKETAUX_KEY', '');
    vi.stubEnv('FINNHUB_KEY', '');
    vi.stubEnv('X_RAPIDAPI_KEY', '');
    vi.stubEnv('TIINGO_API_KEY', '');

    vi.resetModules();
    const { hasNewsProviderKeys } = await import('@/lib/env');
    expect(hasNewsProviderKeys()).toBe(true);
  });
});

interface NewsProviderEnv {
  newsApiKey: string;
  gnewsApiKey: string;
  alphaVantageApiKey: string;
  fmpApiKey: string;
  marketauxKey: string;
  finnhubKey: string;
  rapidApiKey: string;
  tiingoApiKey: string;
}

function readKey(
  name:
    | 'NEWSAPI_KEY'
    | 'GNEWS_API_KEY'
    | 'ALPHAVANTAGE_API_KEY'
    | 'FMP_API_KEY'
    | 'MARKETAUX_KEY'
    | 'FINNHUB_KEY'
    | 'X_RAPIDAPI_KEY'
    | 'TIINGO_API_KEY',
): string {
  return (process.env[name] ?? '').trim();
}

function getNewsProviderEnv(): NewsProviderEnv {
  const env: NewsProviderEnv = {
    newsApiKey: readKey('NEWSAPI_KEY'),
    gnewsApiKey: readKey('GNEWS_API_KEY'),
    alphaVantageApiKey: readKey('ALPHAVANTAGE_API_KEY'),
    fmpApiKey: readKey('FMP_API_KEY'),
    marketauxKey: readKey('MARKETAUX_KEY'),
    finnhubKey: readKey('FINNHUB_KEY'),
    rapidApiKey: readKey('X_RAPIDAPI_KEY'),
    tiingoApiKey: readKey('TIINGO_API_KEY'),
  };

  const missing = Object.entries(env)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0 && process.env.NODE_ENV !== 'production') {
    console.info(
      `[news-env] Missing provider keys: ${missing.join(', ')}. Falling back to demo data if live providers fail.`,
    );
  }

  const totalKeys = Object.keys(env).length;
  if (process.env.NODE_ENV === 'production' && missing.length === totalKeys) {
    console.warn(
      '[news-env] No news provider keys configured. The /api/news route will serve fallback demo data.',
    );
  }

  return env;
}

export const newsProviderEnv = getNewsProviderEnv();

/** Returns true if at least one news provider API key is configured. */
export function hasNewsProviderKeys(): boolean {
  return Object.values(newsProviderEnv).some(Boolean);
}

// ---------------------------------------------------------------------------
// X Auto-Poster env vars — same validation pattern as above
// ---------------------------------------------------------------------------

interface XPosterEnv {
  bearerToken:    string;
  clientId:       string;
  clientSecret:   string;
  nextAuthSecret: string;
  adminSecret:    string;
  cronSecret:     string;
  kvUrl:          string;
  kvToken:        string;
}

function readXKey(
  name:
    | 'X_BEARER_TOKEN'
    | 'X_CLIENT_ID'
    | 'X_CLIENT_SECRET'
    | 'NEXTAUTH_SECRET'
    | 'ADMIN_SECRET'
    | 'CRON_SECRET'
    | 'FINPULSE_KV_REST_API_URL'
    | 'FINPULSE_KV_REST_API_TOKEN',
): string {
  return (process.env[name] ?? '').trim();
}

function getXPosterEnv(): XPosterEnv {
  const env: XPosterEnv = {
    bearerToken:    readXKey('X_BEARER_TOKEN'),
    clientId:       readXKey('X_CLIENT_ID'),
    clientSecret:   readXKey('X_CLIENT_SECRET'),
    nextAuthSecret: readXKey('NEXTAUTH_SECRET'),
    adminSecret:    readXKey('ADMIN_SECRET'),
    cronSecret:     readXKey('CRON_SECRET'),
    kvUrl:          readXKey('FINPULSE_KV_REST_API_URL'),
    kvToken:        readXKey('FINPULSE_KV_REST_API_TOKEN'),
  };

  const missing = Object.entries(env)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0 && process.env.NODE_ENV !== 'production') {
    console.info(
      `[x-poster-env] Missing keys: ${missing.join(', ')}. X auto-poster will not function.`,
    );
  }

  if (process.env.NODE_ENV === 'production' && missing.length > 0) {
    console.warn(
      `[x-poster-env] Missing production keys: ${missing.join(', ')}.`,
    );
  }

  return env;
}

export const xPosterEnv = getXPosterEnv();
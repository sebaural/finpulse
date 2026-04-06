interface NewsProviderEnv {
  newsApiKey: string;
  gnewsApiKey: string;
  alphaVantageApiKey: string;
  fmpApiKey: string;
}

function readKey(
  name:
    | 'NEWSAPI_KEY'
    | 'GNEWS_API_KEY'
    | 'ALPHAVANTAGE_API_KEY'
    | 'NEXT_PUBLIC_FMP_API_KEY',
): string {
  return (process.env[name] ?? '').trim();
}

function getNewsProviderEnv(): NewsProviderEnv {
  const env: NewsProviderEnv = {
    newsApiKey: readKey('NEWSAPI_KEY'),
    gnewsApiKey: readKey('GNEWS_API_KEY'),
    alphaVantageApiKey: readKey('ALPHAVANTAGE_API_KEY'),
    fmpApiKey: readKey('NEXT_PUBLIC_FMP_API_KEY'),
  };

  const missing = Object.entries(env)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0 && process.env.NODE_ENV !== 'production') {
    console.info(
      `[news-env] Missing provider keys: ${missing.join(', ')}. Falling back to demo data if live providers fail.`,
    );
  }

  if (process.env.NODE_ENV === 'production' && missing.length === 4) {
    throw new Error(
      'No news provider keys configured for production. Set at least one of NEWSAPI_KEY, GNEWS_API_KEY, ALPHAVANTAGE_API_KEY, or NEXT_PUBLIC_FMP_API_KEY in your deployment secrets.',
    );
  }

  return env;
}

export const newsProviderEnv = getNewsProviderEnv();
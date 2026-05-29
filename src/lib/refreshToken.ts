import { getStoredTokens, saveTokens } from './tokens';

export async function getValidAccessToken(): Promise<string> {
  const stored = await getStoredTokens();

  if (Date.now() < stored.expiresAt * 1000 - 60_000) {
    return stored.accessToken;
  }

  const clientId     = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('X_CLIENT_ID and X_CLIENT_SECRET must be set for token refresh');
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/x-www-form-urlencoded',
      Authorization:   `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: stored.refreshToken,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Token refresh failed — re-run /api/x-poster/authorize. Status: ${res.status}. Body: ${body}`,
    );
  }

  const data = (await res.json()) as {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
  };

  // X rotates refresh tokens on every use — save the new pair before returning
  await saveTokens({
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    Math.floor(Date.now() / 1000) + data.expires_in,
  });

  return data.access_token;
}

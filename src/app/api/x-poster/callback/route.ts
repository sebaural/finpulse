import { NextRequest, NextResponse } from 'next/server';
import { kv, saveTokens } from '@/lib/tokens';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Missing code parameter' }, { status: 400 });
  }

  const codeVerifier = await kv.get<string>('x_pkce_verifier');
  if (!codeVerifier) {
    return NextResponse.json(
      { error: 'PKCE verifier not found — re-run /api/x-poster/authorize' },
      { status: 400 },
    );
  }

  const clientId     = process.env.X_CLIENT_ID!;
  const clientSecret = process.env.X_CLIENT_SECRET!;
  const credentials  = btoa(`${clientId}:${clientSecret}`);
  const redirectUri  = `${process.env.NEXTAUTH_URL}/api/x-poster/callback`;

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization:  `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json(
      { error: `Token exchange failed: ${res.status} — ${body}` },
      { status: 500 },
    );
  }

  const data = (await res.json()) as {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
  };

  await saveTokens({
    accessToken:  data.access_token,
    refreshToken: data.refresh_token,
    expiresAt:    Math.floor(Date.now() / 1000) + data.expires_in,
  });

  await kv.del('x_pkce_verifier');

  return NextResponse.json({ message: 'Authorization successful. Tokens stored.' });
}

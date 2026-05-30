import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const CLIENT_ID = 'Nk1Pb0JoUmpBam8wMkdRV1pBX2k6MTpjaQ';
const CLIENT_SECRET = process.env.X_CLIENT_SECRET;

const REDIRECT_URI =
  process.env.NODE_ENV === 'production'
    ? 'https://macrostance.com/api/x-poster/callback'
    : 'http://localhost:3000/api/x-poster/callback';

const SUCCESS_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://macrostance.com/'
    : 'http://localhost:3000/';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const codeVerifier = request.cookies.get('code_verifier')?.value;

  if (!code || !codeVerifier) {
    return NextResponse.json(
      { error: 'PKCE verifier not found — re-run /api/x-poster/authorize' },
      { status: 400 }
    );
  }

  const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');

  const tokenRes = await fetch('https://api.x.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      code_verifier: codeVerifier,
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokenRes.ok) {
    return NextResponse.json({ error: tokens }, { status: 400 });
  }

  // Save tokens to database
  await prisma.user.upsert({
  where: { id: 'uralsebastian' },
  update: {
    xAccessToken: tokens.access_token,
    xRefreshToken: tokens.refresh_token,
    xTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  },
  create: {
    id: 'uralsebastian',
    email: 'your@email.com', // ← change to your email
    xAccessToken: tokens.access_token,
    xRefreshToken: tokens.refresh_token,
    xTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
  },
});

  const response = NextResponse.redirect(SUCCESS_URL);
  response.cookies.set('code_verifier', '', { maxAge: 0, path: '/' });

  return response;
}
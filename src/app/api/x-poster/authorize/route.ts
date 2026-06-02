import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { generateCodeChallenge, generateCodeVerifier } from '@/lib/x-oauth';

function getRedirectUri(request: NextRequest): string {
  return new URL('/api/x-poster/callback', request.nextUrl.origin).toString();
}

export async function GET(request: NextRequest) {
  const clientId = process.env.X_CLIENT_ID?.trim();
  if (!clientId) {
    return NextResponse.json({ error: 'X_CLIENT_ID is not configured' }, { status: 500 });
  }

  const redirectUri = getRedirectUri(request);
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString('base64url');

  const authUrl = new URL('https://x.com/i/oauth2/authorize');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', clientId);
  authUrl.searchParams.append('redirect_uri', redirectUri);
  authUrl.searchParams.append('scope', 'tweet.read tweet.write users.read offline.access');
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('code_challenge', codeChallenge);
  authUrl.searchParams.append('code_challenge_method', 'S256');

  const response = NextResponse.redirect(authUrl.toString());

  response.cookies.set('x_code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });

  response.cookies.set('x_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });

  return response;
}
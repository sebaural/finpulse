import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CLIENT_ID = 'Nk1Pb0JoUmpBam8wMkdRV1pBX2k6MTpjaQ';

const REDIRECT_URI = process.env.NODE_ENV === 'production'
  ? 'https://macrostance.com/api/x-poster/callback'
  : 'http://localhost:3000/api/x-poster/callback';

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string) {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

export async function GET() {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(16).toString('base64url');

  const authUrl = new URL('https://x.com/i/oauth2/authorize');
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('client_id', CLIENT_ID);
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('scope', 'tweet.read tweet.write users.read offline.access');
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('code_challenge', codeChallenge);
  authUrl.searchParams.append('code_challenge_method', 'S256');

  const response = NextResponse.redirect(authUrl.toString());

  response.cookies.set('code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60, // 10 minutes
  });

  return response;
}
import { NextResponse } from 'next/server';
import crypto from 'crypto';

const CLIENT_ID = 'Nk1Pb0JoUmpBam8wMkdRV1pBX2k6MTpjaQ';
const SCOPES = 'tweet.read tweet.write users.read offline.access';

const REDIRECT_URI =
  process.env.NODE_ENV === 'production'
    ? 'https://macrostance.com/api/x-poster/callback'
    : 'http://localhost:3000/api/x-poster/callback';

function base64URLEncode(str: Buffer) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function GET() {
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));
  const codeChallenge = base64URLEncode(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );

  const url = new URL('https://x.com/i/oauth2/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('redirect_uri', REDIRECT_URI);
  url.searchParams.set('scope', SCOPES);
  url.searchParams.set('state', crypto.randomBytes(16).toString('hex'));
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');

  const res = NextResponse.redirect(url.toString());
  res.cookies.set('code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  });

  return res;
}
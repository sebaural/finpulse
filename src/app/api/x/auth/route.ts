import { NextResponse } from 'next/server';
import crypto from 'crypto';

const CLIENT_ID = 'Nk1Pb0JoUmpBam8wMkdRV1pBX2k6MTpjaQ';
const REDIRECT_URI =
  process.env.NODE_ENV === 'production'
    ? 'https://macrostance.com/api/x-poster/callback'
    : 'http://localhost:3000/api/x-poster/callback';
const SCOPES = 'tweet.read tweet.write users.read offline.access';

function base64URLEncode(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function sha256(buffer: string): Buffer {
  return crypto.createHash('sha256').update(buffer).digest();
}

export async function GET() {
  const codeVerifier = base64URLEncode(crypto.randomBytes(32));
  const codeChallenge = base64URLEncode(sha256(codeVerifier));

  const authUrl = new URL('https://x.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', crypto.randomBytes(16).toString('hex'));
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set('code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  });

  return response;
}
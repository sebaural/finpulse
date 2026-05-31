import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CLIENT_ID = 'eFgxMFQzY1oyTFgxUUw2Nk5XWnI6MTpjaQ';

// const REDIRECT_URI =
//   process.env.NODE_ENV === 'production'
//     ? 'https://macrostance.com/api/x-poster/callback'
//     : 'http://localhost:3000/api/x-poster/callback';

const REDIRECT_URI = 'https://macrostance.com/api/x-poster/callback'; // hard-coded for test

function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string) {
  return crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
}

export async function GET(request: NextRequest) {
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

  // ← THIS IS THE CRITICAL PART
  response.cookies.set('code_verifier', codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',        // Important: 'lax' or 'none'
    path: '/',
    maxAge: 10 * 60,        // 10 minutes
  });

  // Optional: also store state if you want to validate it later
  // response.cookies.set('oauth_state', state, { ...same options });

  return response;
}
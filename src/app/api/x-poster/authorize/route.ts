import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { kv } from '@/lib/tokens';

export async function GET(request: NextRequest) {
  const adminSecret = request.headers.get('x-admin-secret');
  if (!adminSecret || adminSecret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Generate PKCE code verifier (96 chars, base64url-safe)
  const codeVerifier = crypto.randomBytes(72).toString('base64url');

  // SHA-256 hash → base64url encode (no padding) → code challenge
  const hash          = crypto.createHash('sha256').update(codeVerifier).digest();
  const codeChallenge = hash.toString('base64url');

  // Store verifier in KV with 600s TTL
  await kv.set('x_pkce_verifier', codeVerifier, { ex: 600 });

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/x-poster/callback`;

  const params = new URLSearchParams({
    response_type:         'code',
    client_id:             process.env.X_CLIENT_ID!,
    redirect_uri:          redirectUri,
    scope:                 'tweet.read tweet.write users.read offline.access',
    state:                 'state',
    code_challenge:        codeChallenge,
    code_challenge_method: 'S256',
  });

  return NextResponse.json({
    message:      'Open this URL in your browser to authorize',
    authorizeUrl: `https://twitter.com/i/oauth2/authorize?${params.toString()}`,
  });
}

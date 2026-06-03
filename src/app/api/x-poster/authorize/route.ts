import { NextResponse } from 'next/server';
import { generateCodeVerifier, generateCodeChallenge } from '@/lib/x-oauth';

export async function GET() {
  const clientId = process.env.X_CLIENT_ID;
  const redirectUri = process.env.X_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: 'X_CLIENT_ID or X_REDIRECT_URI is not configured' },
      { status: 500 }
    );
  }

  // Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomUUID();

  // Store PKCE values in httpOnly cookie (valid for 10 minutes)
  const oauthData = JSON.stringify({ codeVerifier, state });
  const cookie = `x_oauth=${encodeURIComponent(oauthData)}; HttpOnly; Path=/; Max-Age=600; Secure; SameSite=Lax`;

  // Build X OAuth 2.0 authorize URL
 
const params = new URLSearchParams({
  response_type: 'code',
  client_id: clientId,
  redirect_uri: redirectUri,
  scope: 'tweet.read tweet.write users.read offline.access media.write',
  state,
  code_challenge: codeChallenge,
  code_challenge_method: 'S256',
  prompt: 'consent',           // ← Add this line
});


  const authorizeUrl = `https://x.com/i/oauth2/authorize?${params.toString()}`;

  return NextResponse.redirect(authorizeUrl, {
    headers: {
      'Set-Cookie': cookie,
    },
  });
}
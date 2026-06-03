import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/x-oauth';
import { saveXTokens } from '@/lib/x-token';

function getRedirectUri(request: NextRequest): string {
  return process.env.X_REDIRECT_URI?.trim()
    || new URL('/api/x-poster/callback', request.nextUrl.origin).toString();
}

function getDashboardUrl(request: NextRequest, params?: URLSearchParams): URL {
  const url = new URL('/dashboard', request.nextUrl.origin);
  if (params) {
    url.search = params.toString();
  }

  return url;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const error = request.nextUrl.searchParams.get('error');

  // Handle X authorization errors
  if (error) {
    return NextResponse.redirect(
      getDashboardUrl(request, new URLSearchParams({ 'x-error': error }))
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      getDashboardUrl(request, new URLSearchParams({ 'x-error': 'missing_code_or_state' }))
    );
  }

  // Read PKCE values from cookie
  const oauthCookie = request.cookies.get('x_oauth')?.value;
  if (!oauthCookie) {
    return NextResponse.redirect(
      getDashboardUrl(request, new URLSearchParams({ 'x-error': 'pkce_verifier_not_found' }))
    );
  }

  let codeVerifier = '';
  let storedState = '';

  try {
    const oauthData = JSON.parse(oauthCookie) as { codeVerifier?: string; state?: string };
    codeVerifier = oauthData.codeVerifier ?? '';
    storedState = oauthData.state ?? '';
  } catch {
    return NextResponse.redirect(
      getDashboardUrl(request, new URLSearchParams({ 'x-error': 'invalid_oauth_cookie' }))
    );
  }

  if (!codeVerifier || state !== storedState) {
    return NextResponse.redirect(
      getDashboardUrl(request, new URLSearchParams({ 'x-error': 'state_mismatch' }))
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier, getRedirectUri(request));
    await saveXTokens(tokens);

    // Clear PKCE cookie and redirect to success page
    const response = NextResponse.redirect(
      getDashboardUrl(request, new URLSearchParams({ x: 'connected' }))
    );
    response.cookies.set('x_oauth', '', { maxAge: 0, path: '/' });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[x-poster-callback]', message);
    return NextResponse.redirect(
      getDashboardUrl(request, new URLSearchParams({ 'x-error': message }))
    );
  }
}
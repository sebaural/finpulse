import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/x-oauth';
import { saveXTokens } from '@/lib/x-token';

function getRedirectUri(request: NextRequest): string {
  return new URL('/api/x-poster/callback', request.nextUrl.origin).toString();
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const codeVerifier = request.cookies.get('x_code_verifier')?.value;
  const storedState = request.cookies.get('x_oauth_state')?.value;

  if (!code || !codeVerifier || !state || state !== storedState) {
    return NextResponse.redirect(new URL('/dashboard?x-error=invalid_state', request.nextUrl.origin));
  }

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier, getRedirectUri(request));
    await saveXTokens(tokens);

    const response = NextResponse.redirect(
      new URL('/dashboard?x-connected=success', request.nextUrl.origin),
    );

    response.cookies.delete('x_code_verifier');
    response.cookies.delete('x_oauth_state');

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[x-poster-callback]', message);
    return NextResponse.redirect(
      new URL(`/dashboard?x-error=${encodeURIComponent(message)}`, request.nextUrl.origin),
    );
  }
}
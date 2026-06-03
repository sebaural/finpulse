import { NextRequest, NextResponse } from 'next/server';
import { clearXTokens } from '@/lib/x-token';

function getDashboardUrl(request: NextRequest): URL {
  return new URL('/dashboard', request.nextUrl.origin);
}

export async function POST(request: NextRequest) {
  await clearXTokens();

  const response = NextResponse.redirect(getDashboardUrl(request));

  response.cookies.set('x_oauth', '', { maxAge: 0, path: '/' });
  response.cookies.set('x_access_token', '', { maxAge: 0, path: '/' });

  return response;
}
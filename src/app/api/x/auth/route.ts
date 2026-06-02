import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/api/x-poster/authorize', request.nextUrl.origin));
}
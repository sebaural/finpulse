import { NextResponse } from 'next/server';
import { refreshStoredXToken } from '@/lib/x-token';

export async function POST() {
  try {
    const { expiresAt } = await refreshStoredXToken();

    return NextResponse.json({ success: true, expiresAt });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
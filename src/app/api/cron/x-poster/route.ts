import { NextRequest } from 'next/server';
import { isCronAuthorized, runXPosterPipeline } from '@/server/cron';

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const results = await runXPosterPipeline();
  return Response.json({ success: true, results });
}
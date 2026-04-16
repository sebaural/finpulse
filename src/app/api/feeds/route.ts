import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { listFeedSources, saveFeedSources } from './feedsStore';
import { clearNewsCache } from '../news/newsCache';
import type { FeedSource } from '../../../types';

interface CreateFeedSourceInput {
  name?: string;
  type?: 'rss' | 'api';
  url?: string;
  enabled?: boolean;
  category?: string;
  parser?: 'rss2json' | 'json' | 'custom';
  apiKeyEnv?: string;
  refreshIntervalSec?: number;
  priority?: 1 | 2 | 3;
}

function validateCreateInput(input: CreateFeedSourceInput): string | null {
  if (!input.name?.trim()) return 'name is required';
  if (!input.type || (input.type !== 'rss' && input.type !== 'api')) return 'type must be rss or api';
  if (!input.url?.trim()) return 'url is required';
  if (!input.category?.trim()) return 'category is required';
  if (!input.parser || !['rss2json', 'json', 'custom'].includes(input.parser)) {
    return 'parser must be rss2json, json, or custom';
  }
  if (typeof input.refreshIntervalSec !== 'number' || input.refreshIntervalSec < 15) {
    return 'refreshIntervalSec must be a number >= 15';
  }
  if (!input.priority || ![1, 2, 3].includes(input.priority)) {
    return 'priority must be 1, 2, or 3';
  }
  return null;
}

export async function GET() {
  const sources = await listFeedSources();
  return NextResponse.json({ sources });
}

export async function POST(request: Request) {
  let body: CreateFeedSourceInput;

  try {
    body = (await request.json()) as CreateFeedSourceInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const validationError = validateCreateInput(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const sources = await listFeedSources();

  const source: FeedSource = {
    id: randomUUID(),
    name: body.name!.trim(),
    type: body.type!,
    url: body.url!.trim(),
    enabled: body.enabled ?? true,
    category: body.category!.trim(),
    parser: body.parser!,
    apiKeyEnv: body.apiKeyEnv?.trim() || undefined,
    refreshIntervalSec: body.refreshIntervalSec!,
    priority: body.priority!,
  };

  sources.push(source);
  await saveFeedSources(sources);
  clearNewsCache();

  return NextResponse.json({ source }, { status: 201 });
}

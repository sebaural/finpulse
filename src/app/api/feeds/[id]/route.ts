import { NextResponse } from 'next/server';
import { listFeedSources, saveFeedSources } from '../feedsStore';
import { clearNewsCache } from '../../news/newsCache';
import type { FeedSource } from '../../../../types';

type UpdateInput = Partial<Omit<FeedSource, 'id'>>;

function sanitizeUpdate(input: UpdateInput): UpdateInput {
  const out: UpdateInput = {};

  if (typeof input.name === 'string') out.name = input.name.trim();
  if (input.type === 'rss' || input.type === 'api') out.type = input.type;
  if (typeof input.url === 'string') out.url = input.url.trim();
  if (typeof input.enabled === 'boolean') out.enabled = input.enabled;
  if (typeof input.category === 'string') out.category = input.category.trim();
  if (input.parser && ['rss2json', 'json', 'custom'].includes(input.parser)) out.parser = input.parser;
  if (typeof input.apiKeyEnv === 'string') out.apiKeyEnv = input.apiKeyEnv.trim() || undefined;
  if (typeof input.refreshIntervalSec === 'number' && input.refreshIntervalSec >= 15) {
    out.refreshIntervalSec = input.refreshIntervalSec;
  }
  if (input.priority && [1, 2, 3].includes(input.priority)) out.priority = input.priority;

  return out;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  let body: UpdateInput;
  try {
    body = (await request.json()) as UpdateInput;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
  }

  const update = sanitizeUpdate(body);
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
  }

  const sources = await listFeedSources();
  const idx = sources.findIndex((s) => s.id === id);
  if (idx < 0) {
    return NextResponse.json({ error: 'Feed source not found' }, { status: 404 });
  }

  const next: FeedSource = {
    ...sources[idx],
    ...update,
  };

  sources[idx] = next;
  await saveFeedSources(sources);
  clearNewsCache();

  return NextResponse.json({ source: next });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const sources = await listFeedSources();
  const next = sources.filter((s) => s.id !== id);

  if (next.length === sources.length) {
    return NextResponse.json({ error: 'Feed source not found' }, { status: 404 });
  }

  await saveFeedSources(next);
  clearNewsCache();
  return NextResponse.json({ ok: true });
}

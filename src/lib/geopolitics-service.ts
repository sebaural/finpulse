// src/lib/geopolitics-service.ts

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './db';
import { detectImportance } from '@/services/news';
import type { SummaryArticle, SourceArticle } from '@/types/geopolitics';

// ---------------------------------------------------------------------------
// NewsAPI response shape
// ---------------------------------------------------------------------------

interface NewsApiArticle {
  title: string | null;
  url: string | null;
  source: { name: string | null };
  publishedAt: string | null;
  description: string | null;
}

interface NewsApiResponse {
  status: string;
  articles: NewsApiArticle[];
}

// ---------------------------------------------------------------------------
// Finnhub general-news response shape
// ---------------------------------------------------------------------------

interface FinnhubNewsArticle {
  category: string;
  datetime: number; // Unix timestamp (seconds)
  headline: string;
  id: number;
  related: string;
  source: string;
  summary: string;
  url: string;
}

// ---------------------------------------------------------------------------
// Claude JSON response shape
// ---------------------------------------------------------------------------

interface ClaudeGeopoliticsResponse {
  title: string;
  summary: string;
  keyPoints: string[];
  region: string;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Private helper: map raw Prisma row → SummaryArticle
// ---------------------------------------------------------------------------

function mapDbToSummary(row: {
  id: string;
  title: string;
  summary: string;
  keyPoints: unknown;
  sourceArticles: unknown;
  region: string;
  tags: unknown;
  date: string;
  createdAt: Date;
}): SummaryArticle {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    keyPoints: Array.isArray(row.keyPoints) ? (row.keyPoints as string[]) : [],
    sourceArticles: Array.isArray(row.sourceArticles)
      ? (row.sourceArticles as SourceArticle[])
      : [],
    region: row.region,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    date: row.date,
    createdAt: row.createdAt,
  };
}

// ---------------------------------------------------------------------------
// 1. Fetch top geopolitics articles — NewsAPI + Finnhub in parallel
// ---------------------------------------------------------------------------

async function fetchFromNewsApi(apiKey: string): Promise<SourceArticle[]> {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const query = encodeURIComponent(
    'geopolitics OR "international relations" OR "foreign policy" OR diplomacy',
  );
  const url =
    `https://newsapi.org/v2/everything` +
    `?q=${query}` +
    `&language=en` +
    `&sortBy=publishedAt` +
    `&from=${twoDaysAgo}` +
    `&pageSize=20` +
    `&apiKey=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`NewsAPI error ${res.status}: ${body}`);
  }
  const data = (await res.json()) as NewsApiResponse;
  return data.articles.map((a) => ({
    title: a.title ?? 'Untitled',
    url: a.url ?? '',
    source: a.source.name ?? 'Unknown',
    publishedAt: a.publishedAt ?? new Date().toISOString(),
    description: a.description ?? undefined,
  }));
}

async function fetchFromFinnhub(apiKey: string): Promise<SourceArticle[]> {
  // Finnhub "general" news endpoint — returns latest 100 headlines across all categories.
  // We pass the category filter "general" which covers geopolitics, world news, etc.
  const url =
    `https://finnhub.io/api/v1/news` +
    `?category=general` +
    `&token=${apiKey}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Finnhub error ${res.status}: ${body}`);
  }
  const data = (await res.json()) as FinnhubNewsArticle[];
  return data.map((a) => ({
    title: a.headline || 'Untitled',
    url: a.url || '',
    source: a.source || 'Finnhub',
    publishedAt: new Date(a.datetime * 1000).toISOString(),
    description: a.summary || undefined,
  }));
}

export async function fetchTopGeopoliticsArticles(): Promise<SourceArticle[]> {
  const newsApiKey = process.env.NEWS_API_KEY;
  const finnhubKey = process.env.FINNHUB_KEY;

  if (!newsApiKey) throw new Error('NEWS_API_KEY environment variable is not set');
  if (!finnhubKey) throw new Error('FINNHUB_KEY environment variable is not set');

  // Fetch both sources in parallel; let either fail independently.
  const [newsApiResult, finnhubResult] = await Promise.allSettled([
    fetchFromNewsApi(newsApiKey),
    fetchFromFinnhub(finnhubKey),
  ]);

  const newsApiArticles = newsApiResult.status === 'fulfilled' ? newsApiResult.value : [];
  const finnhubArticles = finnhubResult.status === 'fulfilled' ? finnhubResult.value : [];

  if (newsApiResult.status === 'rejected') {
    console.error('[geo-pipeline] NewsAPI fetch failed:', newsApiResult.reason);
  }
  if (finnhubResult.status === 'rejected') {
    console.error('[geo-pipeline] Finnhub fetch failed:', finnhubResult.reason);
  }

  // Merge and deduplicate by URL.
  const seenUrls = new Set<string>();
  const combined: SourceArticle[] = [];
  for (const article of [...newsApiArticles, ...finnhubArticles]) {
    const key = article.url.trim().toLowerCase();
    if (key && seenUrls.has(key)) continue;
    if (key) seenUrls.add(key);
    combined.push(article);
  }

  // Sort newest-first then filter for "important" articles (importance === 2
  // = class="priority-dot important" in the news card UI).
  const sorted = [...combined].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  const importantArticles = sorted.filter(
    (a) => detectImportance(`${a.title} ${a.description ?? ''}`) === 2,
  );

  if (importantArticles.length === 0) {
    throw new Error(
      'No "important" (priority-dot important) geopolitics articles found across ' +
      'NewsAPI and Finnhub in the last 2 days. Pipeline aborted — will retry on next cron run.',
    );
  }

  // Return up to 5 most-recent important articles.
  return importantArticles.slice(0, 5);
}

// ---------------------------------------------------------------------------
// 2. Generate AI summary via Anthropic Claude
// ---------------------------------------------------------------------------

export async function generateSummaryArticle(
  articles: SourceArticle[],
): Promise<Omit<SummaryArticle, 'id' | 'createdAt'>> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY environment variable is not set');

  const client = new Anthropic({ apiKey: anthropicKey });

  const articlesText = articles
    .map(
      (a, i) =>
        `Article ${i + 1}:\n` +
        `Title: ${a.title}\n` +
        `Source: ${a.source}\n` +
        `Published: ${a.publishedAt}\n` +
        `Description: ${a.description ?? 'N/A'}\n`,
    )
    .join('\n---\n');

  const prompt =
    `You are analyzing today's top geopolitical news. Here are ${articles.length} articles:\n\n` +
    `${articlesText}\n\n` +
    `Based on these articles, produce a comprehensive geopolitical intelligence briefing.\n` +
    `Respond with PURE JSON only — no markdown fences, no explanation text, just the JSON object.\n\n` +
    `Required JSON shape:\n` +
    `{\n` +
    `  "title": "unique compelling headline specific to today's events",\n` +
    `  "summary": "3-4 paragraph analytical narrative synthesizing all articles",\n` +
    `  "keyPoints": ["5-7 concise bullet points"],\n` +
    `  "region": "primary world region (Middle East / Europe / Asia-Pacific / Global / etc.)",\n` +
    `  "tags": ["4-6 country names, topics, or organizations"]\n` +
    `}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1500,
    system:
      'You are a senior geopolitical analyst with 25 years of experience. ' +
      'You synthesize news from multiple sources into clear, accurate intelligence briefings. ' +
      'You always respond with valid JSON only — never markdown, never code fences.',
    messages: [{ role: 'user', content: prompt }],
  });

  const firstContent = response.content[0];
  if (firstContent.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const parsed = JSON.parse(firstContent.text.trim()) as ClaudeGeopoliticsResponse;

  const today = new Date().toISOString().split('T')[0];

  return {
    title: parsed.title,
    summary: parsed.summary,
    keyPoints: parsed.keyPoints,
    sourceArticles: articles,
    region: parsed.region,
    tags: parsed.tags,
    date: today,
  };
}

// ---------------------------------------------------------------------------
// 3. Save (upsert) summary article to the database
// ---------------------------------------------------------------------------

export async function saveSummaryArticle(
  data: Omit<SummaryArticle, 'id' | 'createdAt'>,
): Promise<SummaryArticle> {
  const existing = await prisma.summaryArticle.findFirst({
    where: { date: data.date },
  });

  const payload = {
    title: data.title,
    summary: data.summary,
    keyPoints: data.keyPoints,
    sourceArticles: data.sourceArticles as unknown as Parameters<
      typeof prisma.summaryArticle.create
    >[0]['data']['sourceArticles'],
    region: data.region,
    tags: data.tags,
    date: data.date,
  };

  let row: Awaited<ReturnType<typeof prisma.summaryArticle.create>>;

  if (existing) {
    row = await prisma.summaryArticle.update({
      where: { id: existing.id },
      data: payload,
    });
  } else {
    row = await prisma.summaryArticle.create({ data: payload });
  }

  return mapDbToSummary(row);
}

// ---------------------------------------------------------------------------
// 4. Fetch many summary articles
// ---------------------------------------------------------------------------

export async function getSummaryArticles(limit = 20): Promise<SummaryArticle[]> {
  const rows = await prisma.summaryArticle.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(mapDbToSummary);
}

// ---------------------------------------------------------------------------
// 5. Fetch one summary article by date
// ---------------------------------------------------------------------------

export async function getSummaryArticleByDate(date: string): Promise<SummaryArticle | null> {
  const row = await prisma.summaryArticle.findFirst({ where: { date } });
  return row ? mapDbToSummary(row) : null;
}

// ---------------------------------------------------------------------------
// 6. Full daily pipeline: fetch → generate → save → return
// ---------------------------------------------------------------------------

export async function runDailyGeopoliticsPipeline(): Promise<SummaryArticle> {
  const articles = await fetchTopGeopoliticsArticles();

  if (articles.length === 0) {
    throw new Error(
      'No articles returned from NewsAPI. The API key may be invalid, ' +
      'the plan may not support the requested date range, or the query returned no results.',
    );
  }

  const generated = await generateSummaryArticle(articles);
  const saved = await saveSummaryArticle(generated);
  return saved;
}

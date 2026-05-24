// src/lib/markets-service.ts

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from './db';
import { detectImportance } from '@/services/news';
import type { SummaryArticle, SourceArticle } from '@/types/markets';

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

interface ClaudeMarketsResponse {
  title: string;
  slug: string;
  summary: string;
  keyPoints: string[];
  region: string;
  tags: string[];
}

// ---------------------------------------------------------------------------
// Private helper: derive a URL-safe slug from an article title
// ---------------------------------------------------------------------------

export function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

// ---------------------------------------------------------------------------
// Private helper: map raw Prisma row → SummaryArticle
// ---------------------------------------------------------------------------

function mapDbToSummary(row: {
  id: string;
  title: string;
  slug: string;
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
    slug: row.slug || toSlug(row.title),
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
// 1. Fetch top markets articles — NewsAPI + Finnhub in parallel
// ---------------------------------------------------------------------------

async function fetchFromNewsApi(apiKey: string): Promise<SourceArticle[]> {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const query = encodeURIComponent(
    '"stock market" OR "equities" OR "bond market" OR "interest rates" OR "Federal Reserve" OR "earnings"',
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
  // The "general" category includes business/markets headlines.
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

export async function fetchTopMarketsArticles(): Promise<SourceArticle[]> {
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
    console.error('[markets-pipeline] NewsAPI fetch failed:', newsApiResult.reason);
  }
  if (finnhubResult.status === 'rejected') {
    console.error('[markets-pipeline] Finnhub fetch failed:', finnhubResult.reason);
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

  const BLOCKED_DOMAINS = ['rt.com'];
  const filtered = combined.filter(
    (a) => !BLOCKED_DOMAINS.some((d) => a.url.toLowerCase().includes(d)),
  );

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  const importantArticles = sorted.filter(
    (a) => detectImportance(`${a.title} ${a.description ?? ''}`) === 2,
  );

  if (importantArticles.length === 0) {
    throw new Error(
      'No "important" (priority-dot important) markets articles found across ' +
      'NewsAPI and Finnhub in the last 2 days. Pipeline aborted — will retry on next cron run.',
    );
  }

  return importantArticles.slice(0, 5);
}

// ---------------------------------------------------------------------------
// 2. Generate AI summary via Anthropic Claude
// ---------------------------------------------------------------------------

export async function generateMarketsSummaryArticle(
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
    `You are analyzing today's top markets news. Here are ${articles.length} articles:\n\n` +
    `${articlesText}\n\n` +
    `Based on these articles, produce a comprehensive markets intelligence report.\n` +
    `Respond with PURE JSON only — no markdown fences, no explanation text, just the JSON object.\n\n` +
    `CRITICAL REQUIREMENTS FOR THE "summary" FIELD:\n` +
    `- Maximum 800 words. Use the word count to explore nuanced causal relationships,\n` +
    `  second-order effects, and cross-asset linkages. No filler — every sentence must add depth.\n` +
    `- Structure the content using these EXACT section headers (bold markdown):\n` +
    `  **INTRODUCTION** — Establish today's market environment. Identify the immediate\n` +
    `    catalyst (data print, central-bank decision, earnings shock, etc.).\n` +
    `  **HISTORICAL CONTEXT** — Detail the multi-month or multi-cycle trends, prior policy\n` +
    `    regimes, and structural forces (inflation regime, liquidity cycle) that led here.\n` +
    `  **PRIMARY STAKEHOLDERS** — Analyze key actors: central banks, institutional investors,\n` +
    `    corporate earners, retail flows. Cover their constraints, incentives, and positioning.\n` +
    `  **ECONOMIC IMPLICATIONS** — Evaluate impacts on equities, fixed income, FX, commodities,\n` +
    `    credit spreads, and volatility surfaces. Reference specific indices, yields, or sectors.\n` +
    `  **FUTURE PROJECTIONS** — Provide three scenarios:\n` +
    `    - BEST CASE: [scenario + logic-based justification]\n` +
    `    - BASE CASE: [scenario + logic-based justification]\n` +
    `    - WORST CASE: [scenario + logic-based justification]\n` +
    `- Tone: academic yet accessible — objective, analytical, data-driven.\n\n` +
    `Required JSON shape:\n` +
    `{\n` +
    `  "title": "engaging, professional headline capturing the day's market signal",\n` +
    `  "slug": "url slug — exactly 4-5 lowercase words joined by hyphens (max 4 hyphens total); letters and hyphens only (no numbers, no underscores, no special chars); pick the 4-5 nouns/proper nouns that uniquely identify the article angle; drop stop words (on the for and with meets of); verify hyphen count ≤ 4 before finalising",\n` +
    `  "summary": "<full structured report — max 800 words — following the sections above>",\n` +
    `  "keyPoints": ["5-7 concise market takeaways from the report"],\n` +
    `  "region": "primary market region (US / Europe / Asia-Pacific / Global / EM / etc.)",\n` +
    `  "tags": ["4-6 asset classes, sectors, indices, or instruments"]\n` +
    `}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    system:
      'You are a Senior Macro Markets Strategist and Lead Content Strategist with 25 years of ' +
      'experience producing investment research for institutional asset managers, hedge funds, ' +
      'and central-bank counterparties. You synthesize conflicting flow, positioning, and ' +
      'macro signals into authoritative, nuanced reports that expose structural forces others ' +
      'miss. You always respond with valid JSON only — never markdown fences, never code fences.',
    messages: [{ role: 'user', content: prompt }],
  });

  const firstContent = response.content[0];
  if (firstContent.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const parsed = JSON.parse(firstContent.text.trim()) as ClaudeMarketsResponse;

  const today = new Date().toISOString().split('T')[0];

  return {
    title: parsed.title,
    slug: parsed.slug,
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

export async function saveMarketsSummaryArticle(
  data: Omit<SummaryArticle, 'id' | 'createdAt'>,
): Promise<SummaryArticle> {
  const existing = await prisma.marketsArticle.findFirst({
    where: { date: data.date },
  });

  const payload = {
    title: data.title,
    slug: data.slug,
    summary: data.summary,
    keyPoints: data.keyPoints,
    sourceArticles: data.sourceArticles as unknown as Parameters<
      typeof prisma.marketsArticle.create
    >[0]['data']['sourceArticles'],
    region: data.region,
    tags: data.tags,
    date: data.date,
  };

  let row: Awaited<ReturnType<typeof prisma.marketsArticle.create>>;

  if (existing) {
    row = await prisma.marketsArticle.update({
      where: { id: existing.id },
      data: payload,
    });
  } else {
    row = await prisma.marketsArticle.create({ data: payload });
  }

  return mapDbToSummary(row);
}

// ---------------------------------------------------------------------------
// 4. Fetch many markets summary articles
// ---------------------------------------------------------------------------

export async function getMarketsSummaryArticles(limit = 20): Promise<SummaryArticle[]> {
  const rows = await prisma.marketsArticle.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(mapDbToSummary);
}

// ---------------------------------------------------------------------------
// 5. Fetch one markets summary article by date
// ---------------------------------------------------------------------------

export async function getMarketsSummaryArticleByDate(date: string): Promise<SummaryArticle | null> {
  const row = await prisma.marketsArticle.findFirst({ where: { date } });
  return row ? mapDbToSummary(row) : null;
}

// ---------------------------------------------------------------------------
// 6. Full daily pipeline: fetch → generate → save → return
// ---------------------------------------------------------------------------

export async function runDailyMarketsPipeline(): Promise<SummaryArticle> {
  const articles = await fetchTopMarketsArticles();

  if (articles.length === 0) {
    throw new Error(
      'No articles returned from NewsAPI. The API key may be invalid, ' +
      'the plan may not support the requested date range, or the query returned no results.',
    );
  }

  const generated = await generateMarketsSummaryArticle(articles);
  const saved = await saveMarketsSummaryArticle(generated);
  return saved;
}

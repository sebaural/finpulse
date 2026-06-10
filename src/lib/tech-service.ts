// src/lib/tech-service.ts

import Anthropic from '@anthropic-ai/sdk';
import { getPrisma } from './db';
import { detectImportance } from '@/services/news';
import type { SummaryArticle, SourceArticle } from '@/types/tech';
import { canonicalizeSlug, selectImportantArticles, toSlug } from '@/lib/summary-pipeline';

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

interface FinnhubNewsArticle {
  category: string;
  datetime: number;
  headline: string;
  id: number;
  related: string;
  source: string;
  summary: string;
  url: string;
}

interface ClaudeTechResponse {
  title: string;
  slug: string;
  summary: string;
  keyPoints: string[];
  region: string;
  tags: string[];
}

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
  const canonicalSlug = canonicalizeSlug(row.slug || toSlug(row.title));

  return {
    id: row.id,
    title: row.title,
    slug: canonicalSlug,
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

async function fetchFromNewsApi(apiKey: string): Promise<SourceArticle[]> {
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];
  const query = encodeURIComponent(
    '"artificial intelligence" OR "semiconductor" OR "cloud computing" OR "big tech" OR "software" OR "cybersecurity"',
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

export async function fetchTopTechArticles(): Promise<SourceArticle[]> {
  const newsApiKey = process.env.NEWS_API_KEY;
  const finnhubKey = process.env.FINNHUB_KEY;

  if (!newsApiKey) throw new Error('NEWS_API_KEY environment variable is not set');
  if (!finnhubKey) throw new Error('FINNHUB_KEY environment variable is not set');

  const [newsApiResult, finnhubResult] = await Promise.allSettled([
    fetchFromNewsApi(newsApiKey),
    fetchFromFinnhub(finnhubKey),
  ]);

  const newsApiArticles = newsApiResult.status === 'fulfilled' ? newsApiResult.value : [];
  const finnhubArticles = finnhubResult.status === 'fulfilled' ? finnhubResult.value : [];

  if (newsApiResult.status === 'rejected') {
    console.error('[tech-pipeline] NewsAPI fetch failed:', newsApiResult.reason);
  }
  if (finnhubResult.status === 'rejected') {
    console.error('[tech-pipeline] Finnhub fetch failed:', finnhubResult.reason);
  }

  return selectImportantArticles(
    [...newsApiArticles, ...finnhubArticles],
    detectImportance,
    'tech',
  );
}

export async function generateTechSummaryArticle(
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
    `You are analyzing today's top technology news. Here are ${articles.length} articles:\n\n` +
    `${articlesText}\n\n` +
    `Based on these articles, produce a comprehensive technology intelligence report.\n` +
    `Respond with PURE JSON only — no markdown fences, no explanation text, just the JSON object.\n\n` +
    `CRITICAL REQUIREMENTS FOR THE "summary" FIELD:\n` +
    `- Maximum 800 words. Use the word count to explore nuanced causal relationships,\n` +
    `  second-order effects, and platform-shift dynamics. No filler — every sentence must add depth.\n` +
    `- Structure the content using these EXACT section headers (plain text only — NO asterisks, NO markdown bold, NO ** around headers):\n` +
    `  INTRODUCTION — Establish today's tech environment. Identify the immediate catalyst\n` +
    `    (product launch, regulatory action, breakthrough, M&A, security incident).\n` +
    `  FUTURE PROJECTIONS — Provide three scenarios:\n` +
    `    - BEST CASE: [scenario + logic-based justification]\n` +
    `    - BASE CASE: [scenario + logic-based justification]\n` +
    `    - WORST CASE: [scenario + logic-based justification]\n` +
    `  HISTORICAL CONTEXT — Detail the multi-cycle technology trends, prior platform shifts,\n` +
    `    research breakthroughs, or regulatory regimes that led to this moment.\n` +
    `  PRIMARY STAKEHOLDERS — Analyze key actors: hyperscalers, model labs, chipmakers,\n` +
    `    regulators, startups, enterprise buyers. Cover their incentives and constraints.\n` +
    `  ECONOMIC IMPLICATIONS — Evaluate impacts on capex cycles, enterprise IT spend,\n` +
    `    semiconductor supply chains, equity multiples, and incumbent moats. Reference\n` +
    `    specific companies, models, chip families, or product lines where possible.\n` +
    `- Tone: academic yet accessible — objective, analytical, data-driven.\n\n` +
    `Required JSON shape:\n` +
    `{\n` +
    `  "title": "engaging, professional headline capturing today's tech signal",\n` +
    `  "slug": "url slug — exactly 4-5 lowercase words joined by hyphens (max 4 hyphens total); letters and hyphens only (no numbers, no underscores, no special chars); pick the 4-5 nouns/proper nouns that uniquely identify the article angle; drop stop words; verify hyphen count ≤ 4 before finalising",\n` +
    `  "summary": "<full structured report — max 800 words — following the sections above>",\n` +
    `  "keyPoints": ["5-7 concise tech takeaways from the report"],\n` +
    `  "region": "primary tech region (US / Europe / Asia-Pacific / Global / China / etc.)",\n` +
    `  "tags": ["4-6 companies, technologies, or product categories"]\n` +
    `}`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    system:
      'You are a Senior Technology Strategist and Lead Content Strategist with 25 years of ' +
      'experience producing technology research for institutional investors, CTOs, and ' +
      'policy makers. You synthesize platform shifts, capex cycles, and regulatory signals ' +
      'into authoritative, nuanced reports that expose structural forces others miss. ' +
      'You always respond with valid JSON only — never markdown fences, never code fences.',
    messages: [{ role: 'user', content: prompt }],
  });

  const firstContent = response.content[0];
  if (firstContent.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  const parsed = JSON.parse(firstContent.text.trim()) as ClaudeTechResponse;

  const today = new Date().toISOString().split('T')[0];

  return {
    title: parsed.title,
    slug: canonicalizeSlug(parsed.slug || parsed.title),
    summary: parsed.summary,
    keyPoints: parsed.keyPoints,
    sourceArticles: articles,
    region: parsed.region,
    tags: parsed.tags,
    date: today,
  };
}

export async function saveTechSummaryArticle(
  data: Omit<SummaryArticle, 'id' | 'createdAt'>,
): Promise<SummaryArticle> {
  const prisma = getPrisma();
  const existing = await prisma.techArticle.findFirst({
    where: { date: data.date },
  });

  const payload = {
    title: data.title,
    slug: canonicalizeSlug(data.slug || data.title),
    summary: data.summary,
    keyPoints: data.keyPoints,
    sourceArticles: data.sourceArticles as unknown as Parameters<
      typeof prisma.techArticle.create
    >[0]['data']['sourceArticles'],
    region: data.region,
    tags: data.tags,
    date: data.date,
  };

  let row: Awaited<ReturnType<typeof prisma.techArticle.create>>;

  if (existing) {
    row = await prisma.techArticle.update({
      where: { id: existing.id },
      data: payload,
    });
  } else {
    row = await prisma.techArticle.create({ data: payload });
  }

  return mapDbToSummary(row);
}

export async function getTechSummaryArticles(limit = 20): Promise<SummaryArticle[]> {
  try {
    const prisma = getPrisma();
    const rows = await prisma.techArticle.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map(mapDbToSummary);
  } catch (error) {
    console.error('[tech-service] failed to load summary articles', error);
    return [];
  }
}

export async function getTechSummaryArticleByDate(date: string): Promise<SummaryArticle | null> {
  try {
    const prisma = getPrisma();
    const row = await prisma.techArticle.findFirst({ where: { date } });
    return row ? mapDbToSummary(row) : null;
  } catch (error) {
    console.error('[tech-service] failed to load summary article by date', error);
    return null;
  }
}

export async function runDailyTechPipeline(): Promise<SummaryArticle> {
  const articles = await fetchTopTechArticles();

  if (articles.length === 0) {
    throw new Error(
      'No articles returned from NewsAPI. The API key may be invalid, ' +
      'the plan may not support the requested date range, or the query returned no results.',
    );
  }

  const generated = await generateTechSummaryArticle(articles);
  const saved = await saveTechSummaryArticle(generated);
  return saved;
}
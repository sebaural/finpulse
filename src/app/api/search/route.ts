import { NextRequest, NextResponse } from "next/server";
import { getPulseArticles } from "@/lib/pulse-service";
import { getMarketsSummaryArticles } from "@/lib/markets-service";
import { getTechSummaryArticles } from "@/lib/tech-service";
import { getSummaryArticles as getGeopoliticsArticles } from "@/lib/geopolitics-service";
import { stripMarkdown } from "@/lib/stripMarkdown";
import { PULSE_SLUGS } from "@/lib/pulse-categories";
import type { PulseArticle } from "@/types/pulse";

export interface SearchResult {
  title: string;
  slug: string;
  excerpt: string;
  section: "pulse" | "markets" | "tech" | "geopolitics";
  url: string;
  publishedAt?: string;
}

function scoreMatch(haystack: string, query: string): number {
  const h = haystack.toLowerCase();
  const q = query.toLowerCase();
  if (!h.includes(q)) return 0;
  return h === q ? 100 : h.startsWith(q) ? 50 : 10;
}

// --- Pulse: fetch all 4 categories in parallel and normalize into SearchResult shape ---
async function fetchPulseResults(q: string): Promise<(SearchResult & { score: number })[]> {
  const perCategory = await Promise.all(
    PULSE_SLUGS.map((slug) =>
      getPulseArticles(slug).catch((err) => {
        console.error(`[search] pulse/${slug} fetch failed:`, err);
        return [] as PulseArticle[];
      })
    )
  );

  const results: (SearchResult & { score: number })[] = [];

  for (const items of perCategory) {
    for (const item of items) {
      const title = item.title ?? "";
      const cleanSummary = stripMarkdown(item.summary ?? "");

      const score = scoreMatch(title, q) * 3 + scoreMatch(cleanSummary, q);

      if (score > 0 && item.articleSlug && item.pulseSlug) {
        results.push({
          title,
          slug: item.articleSlug,
          excerpt: cleanSummary.slice(0, 160).trim(),
          section: "pulse",
          url: `/pulse/${item.pulseSlug}/${item.articleSlug}`,
          publishedAt: item.publishedAt ?? undefined,
          score,
        });
      }
    }
  }

  return results;
}

// --- Markets / Tech / Geopolitics: share the SummaryArticle-like shape ---
// NOTE: limits below (30) intentionally match each vertical's live serving
// window (see [slug]/page.tsx, page.tsx, and /api/*/articles/route.ts for
// each vertical, which all call these with 30). Search must never index more
// than the detail page can resolve, or results link to 404s.
const SUMMARY_SECTIONS: {
  section: "markets" | "tech" | "geopolitics";
  urlPrefix: string;
  fetcher: () => Promise<any[]>;
}[] = [
  { section: "markets", urlPrefix: "/markets", fetcher: () => getMarketsSummaryArticles(30) },
  { section: "tech", urlPrefix: "/tech", fetcher: () => getTechSummaryArticles(30) },
  { section: "geopolitics", urlPrefix: "/geopolitics", fetcher: () => getGeopoliticsArticles(30) },
];

async function fetchSummarySectionResults(q: string): Promise<(SearchResult & { score: number })[]> {
  const buckets = await Promise.all(
    SUMMARY_SECTIONS.map(async ({ section, urlPrefix, fetcher }) => ({
      section,
      urlPrefix,
      items: await fetcher().catch((err) => {
        console.error(`[search] ${section} fetch failed:`, err);
        return [];
      }),
    }))
  );

  const results: (SearchResult & { score: number })[] = [];

  for (const { items, section, urlPrefix } of buckets) {
    for (const item of items) {
      const title: string = item.title ?? "";
      const tags: string[] = Array.isArray(item.tags) ? item.tags : [];
      const cleanSummary: string = stripMarkdown(item.summary ?? "");

      const score =
        scoreMatch(title, q) * 3 +
        scoreMatch(cleanSummary, q) +
        tags.reduce((acc, t) => acc + scoreMatch(t, q) * 2, 0);

      if (score > 0 && item.slug) {
        results.push({
          title,
          slug: item.slug,
          excerpt: cleanSummary.slice(0, 160).trim(),
          section,
          url: `${urlPrefix}/${item.slug}`,
          publishedAt: item.date,
          score,
        });
      }
    }
  }

  return results;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] as SearchResult[] });
  }

  try {
    const [pulseResults, summaryResults] = await Promise.all([
      fetchPulseResults(q),
      fetchSummarySectionResults(q),
    ]);

    const results = [...pulseResults, ...summaryResults].sort((a, b) => b.score - a.score);

    return NextResponse.json({
      results: results.slice(0, 30).map(({ score, ...r }) => r),
    });
  } catch (err) {
    console.error("Search error:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}


// src/lib/macro-prompt.ts
//
// The task prompt for "The Macro Landscape" generation, consuming the contract
// defined in MD_FILES/HOMEPAGE/macro-landscape-generation-prompt.md. The model
// (Claude Sonnet 5) scrapes and reviews the latest financial news itself, live,
// via the web_search server tool enabled on the call — there is no feed
// ingestion step. `publishDate` (America/New_York, YYYY-MM-DD) is injected so
// `title`, `slug`, and `publishedDate` in the output are unambiguous.

export const MACRO_SYSTEM_PROMPT =
  'You are a Senior Macroeconomic Strategist writing a neutral, informative daily ' +
  'financial homepage summary. You have live web search available and MUST use it to ' +
  'scrape and review the latest financial and macroeconomic news before writing, so the ' +
  'section reflects what is actually driving markets today. You always respond with a ' +
  'single valid JSON object only — never markdown code fences, never commentary outside it.';

export function buildMacroPrompt(publishDate: string): string {
  return `# Task: Write "The Macro Landscape" section for ${publishDate} (America/New_York)

Before writing, use web search to scrape and review the latest financial and
macroeconomic news to determine current content. Output must be a single JSON
object with exactly these keys:

- "title" — string. Format: "The Macro Landscape — <Month D, YYYY>", using the
  publish date ${publishDate}, e.g. "The Macro Landscape — July 10, 2026".
- "slug" — string. Format: "macro-landscape-${publishDate}", lowercase, using the
  publish date in America/New_York. Contains only lowercase letters, numbers, and
  hyphens.
- "publishedDate" — string. ISO 8601 date (YYYY-MM-DD) for America/New_York. This
  MUST be exactly "${publishDate}". This is the field the archive is paginated by.
- "body" — string. An HTML fragment, per the Output Format Rules below.

Do not add any other top-level keys. Do not wrap the JSON in markdown code fences.

## Output Format Rules

A. The value of "body" must be an HTML fragment only. Do not use asterisks, markdown
   bold, markdown bullets, or any XML-style wrapper tags. Use semantic HTML. Make each
   subsection title a separate <h2> element. Place the text beneath each heading inside
   <p> elements (use more than one <p> per subsection where it improves readability).

B. Do not embed citations or source links inline. Collect all sources used and list
   them separately in a <ul> block at the very end of the fragment, under a final
   <h2>Sources</h2> heading. Each source should be a <li> containing the source title
   only, with no URL, publication name, author, or date attached.

C. Do not repeat the title or publishedDate as visible text inside body — the archive
   view renders those from their own fields. body should begin directly with the first
   subsection's <h2>.

## Required Subsections

Do not hardcode subsection topics in advance. Before writing, scrape the latest
financial news and determine which themes are currently dominating macroeconomic
discourse, then select and order the subsections based on those findings. Use roughly
four to six subsections. Do not assume any single theme (geopolitical conflict, China
trade data, AI financing, a specific data release, etc.) will be present; the topics,
headings, and content of every subsection should reflect whatever the scraped material
actually shows at generation time, not a fixed list carried over from prior runs.
Consider categories such as the dominant story currently driving markets, equity market
moves, interest rate and monetary policy expectations, notable country or
sector-specific developments, and the broader growth or inflation outlook, but include
only the ones that are genuinely among the top stories at the time of generation, and
drop or replace any that are not.

## Instructions

Scrape and review the latest financial news before writing, and let those results
determine the subsection topics, order, and content. Write in a neutral, informative
tone suitable for a financial homepage summary. Keep each subsection to one short
paragraph. In the final output's Sources list, include the title only for every source
actually used to write the section, with no URLs, outlet names, authors, or dates
attached. Populate title, slug, and publishedDate per the rules above. Return only the
JSON object described above, with no additional commentary outside it.`;
}

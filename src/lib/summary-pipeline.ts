import Anthropic from '@anthropic-ai/sdk';
import { getPrisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client/client';

type Vertical = 'geopolitics' | 'markets' | 'tech' | 'pulse';

/**
 * Slug uniqueness guard across all article tables.
 *
 * Slug has no unique constraint in any table (only title is unique), and the
 * same slug is ambiguous both across verticals and within one: /topics/ and
 * legacy routes resolve a slug with findFirst, so a second row with that slug
 * is unreachable. Every table is checked, including the one being written
 * into; pass `ignore` to skip the row being updated so it doesn't collide with
 * itself.
 */
export async function isSlugTakenAcrossVerticals(
  slug: string,
  ignore?: { vertical: Vertical; id: string },
): Promise<boolean> {
  const prisma = getPrisma();
  const notId = (vertical: Vertical) =>
    ignore?.vertical === vertical ? { id: { not: ignore.id } } : {};
  const [geo, mkt, tech, pulse] = await Promise.all([
    prisma.geopoliticsArticle.findFirst({ where: { slug, ...notId('geopolitics') }, select: { id: true } }),
    prisma.marketsArticle.findFirst({ where: { slug, ...notId('markets') }, select: { id: true } }),
    prisma.techArticle.findFirst({ where: { slug, ...notId('tech') }, select: { id: true } }),
    prisma.pulseArticle.findFirst({ where: { articleSlug: slug, ...notId('pulse') }, select: { id: true } }),
  ]);
  return !!(geo || mkt || tech || pulse);
}

/**
 * Returns `base` if it's free, otherwise the first free slug in the sequence
 * `{base}-{vertical}`, `{base}-{vertical}-2`, `{base}-{vertical}-3`, ...
 * Disambiguates rather than dropping the article, so a day's content is never
 * silently lost. Pass `ownId` when updating an existing row.
 */
export async function resolveUniqueSlug(
  base: string,
  vertical: Exclude<Vertical, 'pulse'>,
  ownId?: string,
): Promise<string> {
  const ignore = ownId ? { vertical, id: ownId } : undefined;
  let candidate = base;
  let attempt = 1;
  while (await isSlugTakenAcrossVerticals(candidate, ignore)) {
    candidate = attempt === 1 ? `${base}-${vertical}` : `${base}-${vertical}-${attempt}`;
    attempt += 1;
  }
  if (candidate !== base) {
    console.warn(`[pipeline] Slug collision: "${base}" — disambiguating as "${candidate}"`);
  }
  return candidate;
}

// ---------------------------------------------------------------------------
// Topic (entity/theme hub) assignment
// ---------------------------------------------------------------------------

export interface TopicChoice {
  name: string;
  slug: string;
}

/**
 * Existing topic hubs for a vertical, most-recently-updated first. Fed into the
 * generation prompt so Claude reuses an existing hub when one fits, instead of
 * minting a near-duplicate every run (which would fragment the hubs).
 */
export async function getTopicChoices(vertical: Vertical, limit = 40): Promise<TopicChoice[]> {
  try {
    const prisma = getPrisma();
    return await prisma.topic.findMany({
      where: { parentVertical: vertical },
      select: { name: true, slug: true },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  } catch (error) {
    console.error('[pipeline] failed to load topic choices', error);
    return [];
  }
}

/**
 * Prompt block instructing the model to assign the briefing to one broad,
 * evergreen topic hub — reusing an existing one when it genuinely fits.
 */
export function buildTopicDirective(choices: TopicChoice[]): string {
  const list = choices.length
    ? choices.map((c) => `  - ${c.name} (${c.slug})`).join('\n')
    : '  (none yet — you will be creating the first topic hub for this vertical)';
  return (
    `TOPIC HUB ASSIGNMENT:\n` +
    `Assign this briefing to exactly ONE broad, evergreen topic hub — a durable entity or\n` +
    `theme that many future briefings could also belong to (e.g. "Federal Reserve Policy",\n` +
    `"US-China Relations", "Artificial Intelligence"), NOT the narrow angle of today's story.\n` +
    `Strongly prefer reusing one of these EXISTING hubs when it genuinely fits:\n` +
    `${list}\n` +
    `Only invent a new hub when none of the above fit. The slug must be 1-4 lowercase words\n` +
    `joined by hyphens (letters and hyphens only).\n\n`
  );
}

type BriefingVertical = Exclude<Vertical, 'pulse'>;

// What each daily briefing leads with. All three pipelines read the same macro
// headlines, so without lanes they publish three near-identical articles a day
// (Fed + Iran sanctions + earnings), which Google treats as duplicate content.
const VERTICAL_LANES: Record<BriefingVertical, string> = {
  geopolitics:
    'states, conflicts, alliances, sanctions and diplomacy. Do NOT lead with central-bank ' +
    'policy, CPI data or corporate earnings — mention them only as consequences.',
  markets:
    'asset prices, rates, earnings, macro data and capital flows. Do NOT lead with diplomacy ' +
    'or technology products — mention them only through their market impact.',
  tech:
    'technology companies, semiconductors, AI, platforms and tech regulation. Do NOT lead with ' +
    'sanctions, oil or inflation prints — mention them only as they affect the tech sector.',
};

/**
 * Titles the OTHER briefing verticals published in the last 24h. The cron runs
 * the pipelines sequentially, so later verticals see earlier ones' output.
 */
export async function getRecentBriefingTitles(
  vertical: BriefingVertical,
  hours = 24,
): Promise<string[]> {
  try {
    const prisma = getPrisma();
    const where = { createdAt: { gte: new Date(Date.now() - hours * 3600_000) } };
    const select = { title: true } as const;
    const [geo, mkt, tech] = await Promise.all([
      vertical === 'geopolitics' ? [] : prisma.geopoliticsArticle.findMany({ where, select }),
      vertical === 'markets' ? [] : prisma.marketsArticle.findMany({ where, select }),
      vertical === 'tech' ? [] : prisma.techArticle.findMany({ where, select }),
    ]);
    return [...geo, ...mkt, ...tech].map((r) => r.title);
  } catch (error) {
    console.error('[pipeline] failed to load recent briefing titles', error);
    return [];
  }
}

/** Prompt block keeping each vertical in its own lane and off today's other briefings. */
export function buildLaneDirective(vertical: BriefingVertical, otherTitles: string[]): string {
  const others = otherTitles.length
    ? `Today's other MacroStance briefings already cover:\n` +
      otherTitles.map((t) => `  - ${t}`).join('\n') +
      `\nChoose a different lead story and a different angle from these; do not repeat their\n` +
      `headline themes.\n`
    : '';
  return (
    `EDITORIAL LANE:\n` +
    `This is the ${vertical} briefing. Lead with ${VERTICAL_LANES[vertical]}\n` +
    others +
    `\n`
  );
}

/**
 * Find-or-create a topic hub by slug and return its id (or null on failure).
 * Slug is globally unique, so a hub minted under one vertical is reused across
 * all verticals; an existing hub's name/parentVertical are left untouched.
 */
export async function upsertTopic(choice: TopicChoice, vertical: Vertical): Promise<string | null> {
  const slug = canonicalizeSlug(choice.slug || choice.name);
  if (!slug) return null;
  try {
    const prisma = getPrisma();
    const topic = await prisma.topic.upsert({
      where: { slug },
      update: {},
      create: { name: choice.name?.trim() || slug, slug, parentVertical: vertical },
    });
    return topic.id;
  } catch (error) {
    console.error(`[pipeline] topic upsert failed for slug "${slug}"`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Topic "storyline" copy — distinct text for /topics/{topic}/{slug}
// ---------------------------------------------------------------------------

export interface TopicCopy {
  topicTitle: string;
  topicSummary: string;
  topicKeyPoints: string[];
}

export interface RecentTopicArticle {
  title: string;
  date: string;
  keyPoints: string[];
}

/**
 * Earlier briefings in the same topic hub (all three verticals), newest first.
 * Feeds the storyline prompt so the /topics copy can trace how the topic got here.
 */
export async function getRecentTopicArticles(
  topicId: string,
  excludeId?: string,
  limit = 5,
): Promise<RecentTopicArticle[]> {
  try {
    const prisma = getPrisma();
    const where = { topicId, ...(excludeId ? { id: { not: excludeId } } : {}) };
    const select = { title: true, date: true, keyPoints: true, createdAt: true } as const;
    const args = { where, select, orderBy: { createdAt: 'desc' as const }, take: limit };
    const [geo, mkt, tech] = await Promise.all([
      prisma.geopoliticsArticle.findMany(args),
      prisma.marketsArticle.findMany(args),
      prisma.techArticle.findMany(args),
    ]);
    return [...geo, ...mkt, ...tech]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .map((r) => ({
        title: r.title,
        date: r.date,
        keyPoints: Array.isArray(r.keyPoints) ? (r.keyPoints as string[]) : [],
      }));
  } catch (error) {
    console.error('[pipeline] failed to load recent topic articles', error);
    return [];
  }
}

/**
 * Second Claude call: writes the /topics version of a briefing from a
 * different angle (the topic's ongoing storyline) so the topic URL and the
 * legacy /{vertical}/{slug} URL don't carry duplicate text. Returns null on any
 * failure — the article still saves, and pages fall back to the daily copy.
 */
export async function generateTopicCopy(input: {
  vertical: BriefingVertical;
  topicId: string;
  excludeId?: string;
  title: string;
  keyPoints: string[];
}): Promise<TopicCopy | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const prisma = getPrisma();
    const [topic, earlier] = await Promise.all([
      prisma.topic.findUnique({ where: { id: input.topicId }, select: { name: true } }),
      getRecentTopicArticles(input.topicId, input.excludeId),
    ]);
    if (!topic) return null;

    const earlierBlock = earlier.length
      ? earlier
          .map((a) => `- ${a.date}: ${a.title}\n` + a.keyPoints.slice(0, 3).map((p) => `    • ${p}`).join('\n'))
          .join('\n')
      : '- (no earlier briefings in this topic yet)';

    const prompt =
      `You are writing the TOPIC page version of today's MacroStance ${input.vertical} briefing.\n` +
      `Topic hub: "${topic.name}".\n\n` +
      `Today's daily briefing (already published on another page — do NOT restate it):\n` +
      `Title: ${input.title}\n` +
      input.keyPoints.map((p) => `- ${p}`).join('\n') +
      `\n\nEarlier briefings in this topic:\n${earlierBlock}\n\n` +
      `Write a storyline analysis: how today's development moves the "${topic.name}" story\n` +
      `forward, measured against what came before. Rules:\n` +
      `- Different angle from the daily briefing: the arc of the topic, not today's event recap.\n` +
      `- Never copy or paraphrase a sentence or takeaway from the daily briefing above.\n` +
      `- Reference earlier briefings by their date where relevant.\n` +
      `- Do not invent statistics, quotes or named sources.\n` +
      `- topicSummary: max 600 words, plain text, exactly these section headers on their own\n` +
      `  lines (no markdown, no asterisks), paragraphs separated by blank lines:\n` +
      `  WHAT CHANGED\n  HOW WE GOT HERE\n  SIGNALS TO WATCH\n` +
      `- topicTitle: a headline about the topic's trajectory, clearly different from today's title.\n` +
      `- topicKeyPoints: 4-6 topic-level implications (not daily facts).\n\n` +
      `Respond with PURE JSON only:\n` +
      `{ "topicTitle": "...", "topicSummary": "...", "topicKeyPoints": ["..."] }`;

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create(
      {
        model: 'claude-opus-5-5',
        max_tokens: 4000,
        output_config: { effort: 'low' },
        system:
          'You are a senior macro editor who tracks long-running stories across many daily ' +
          'briefings. You always respond with valid JSON only — never markdown fences.',
        messages: [{ role: 'user', content: prompt }],
      },
      // The daily cron runs all pipelines inside one 300s function; cap this call.
      { timeout: 90_000, maxRetries: 1 },
    );

    if (response.stop_reason !== 'end_turn') {
      console.warn(`[pipeline] topic copy skipped: stop_reason=${response.stop_reason}`);
      return null;
    }
    const text = response.content.find((b) => b.type === 'text');
    if (!text || text.type !== 'text') return null;

    const parsed = parseClaudeJson<Partial<TopicCopy>>(text.text);
    const keyPoints = Array.isArray(parsed.topicKeyPoints)
      ? parsed.topicKeyPoints.filter((p): p is string => typeof p === 'string' && p.trim() !== '')
      : [];
    if (!parsed.topicTitle?.trim() || !parsed.topicSummary?.trim() || keyPoints.length === 0) {
      console.warn('[pipeline] topic copy skipped: incomplete JSON');
      return null;
    }
    // Same headline as the daily page would defeat the purpose.
    if (parsed.topicTitle.trim().toLowerCase() === input.title.trim().toLowerCase()) return null;

    return {
      topicTitle: parsed.topicTitle.trim(),
      topicSummary: parsed.topicSummary.replace(/\*\*/g, '').trim(),
      topicKeyPoints: keyPoints,
    };
  } catch (error) {
    console.error('[pipeline] topic copy generation failed', error);
    return null;
  }
}

/**
 * Row fields for the topic copy. Always sets all three, so a same-day re-run
 * that fails to produce copy clears the previous run's (now mismatched) text.
 */
export function topicCopyFields(copy: TopicCopy | null) {
  return {
    topicTitle: copy?.topicTitle ?? null,
    topicSummary: copy?.topicSummary ?? null,
    topicKeyPoints: copy ? copy.topicKeyPoints : Prisma.DbNull,
  };
}

interface SourceArticleLike {
  title: string;
  url: string;
  publishedAt: string;
  description?: string;
}

export function safeDecodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function canonicalizeSlug(slug: string): string {
  return safeDecodeSlug(slug)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function toSlug(title: string): string {
  return canonicalizeSlug(title);
}

// Claude sometimes wraps JSON output in markdown code fences (```json ... ```)
// despite being told not to. Strip any surrounding fence before parsing so the
// generation pipelines don't fail on an otherwise-valid response.
export function parseClaudeJson<T>(text: string): T {
  let cleaned = text.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*\n?/i, '')
      .replace(/\n?```\s*$/, '')
      .trim();
  }
  return JSON.parse(cleaned) as T;
}

export function selectImportantArticles<T extends SourceArticleLike>(
  articles: T[],
  detectImportance: (text: string) => number,
  domainLabel: string,
  limit = 5,
): T[] {
  const seenUrls = new Set<string>();
  const deduped: T[] = [];

  for (const article of articles) {
    const key = article.url.trim().toLowerCase();
    if (key && seenUrls.has(key)) continue;
    if (key) seenUrls.add(key);
    deduped.push(article);
  }

  const blockedDomains = ['rt.com'];
  const filtered = deduped.filter(
    (article) => !blockedDomains.some((domain) => article.url.toLowerCase().includes(domain)),
  );

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );

  const important = sorted.filter(
    (article) => detectImportance(`${article.title} ${article.description ?? ''}`) === 2,
  );

  if (important.length === 0) {
    throw new Error(
      `No "important" (priority-dot important) ${domainLabel} articles found across configured providers in the last 2 days. Pipeline aborted — will retry on next cron run.`,
    );
  }

  return important.slice(0, limit);
}

import { getPrisma } from '@/lib/db';

type Vertical = 'geopolitics' | 'markets' | 'tech';

/**
 * Cross-vertical slug uniqueness guard.
 *
 * Prisma enforces uniqueness within each table (via the unique title) but slug
 * is shared across the three article tables with no cross-table constraint. The
 * edge router (get_article_topic_mapping) resolves a slug to a single topic, so
 * the same slug living in two verticals is ambiguous. Call before creating a new
 * article; pass `exclude` to skip the vertical you're writing into.
 */
export async function isSlugTakenAcrossVerticals(
  slug: string,
  exclude?: Vertical,
): Promise<boolean> {
  const prisma = getPrisma();
  const [geo, mkt, tech] = await Promise.all([
    exclude === 'geopolitics'
      ? null
      : prisma.geopoliticsArticle.findFirst({ where: { slug }, select: { id: true } }),
    exclude === 'markets'
      ? null
      : prisma.marketsArticle.findFirst({ where: { slug }, select: { id: true } }),
    exclude === 'tech'
      ? null
      : prisma.techArticle.findFirst({ where: { slug }, select: { id: true } }),
  ]);
  return !!(geo || mkt || tech);
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

interface SourceArticleLike {
  title: string;
  url: string;
  publishedAt: string;
  description?: string;
}

function safeDecodeSlug(slug: string): string {
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

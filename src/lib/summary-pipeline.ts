interface SourceArticleLike {
  title: string;
  url: string;
  publishedAt: string;
  description?: string;
}

export function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
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

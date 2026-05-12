// src/lib/stripMarkdown.ts

/**
 * Strips markdown syntax from a string and returns clean plain text.
 * Safe to use for meta description, og:description, twitter:description,
 * and JSON-LD description fields.
 */
export function stripMarkdown(raw: string): string {
  if (!raw) return '';

  return raw
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')   // links — must run before * / _ strips
    .replace(/^>\s+/gm, '')               // blockquotes
    .replace(/^#{1,6}\s+/gm, '')          // headings
    .replace(/^-{3,}$/gm, '')             // horizontal rules
    .replace(/\*\*(.+?)\*\*/g, '$1')      // bold **
    .replace(/__(.+?)__/g, '$1')          // bold __
    .replace(/\*(.+?)\*/g, '$1')          // italic *
    .replace(/_(.+?)_/g, '$1')            // italic _
    .replace(/`(.+?)`/g, '$1')            // inline code
    .replace(/\s+/g, ' ')                 // collapse all whitespace runs
    .trim();
}

export function truncateDescription(text: string, maxLength = 155): string {
  const clean = stripMarkdown(text);
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength - 1).trimEnd() + '…';
}

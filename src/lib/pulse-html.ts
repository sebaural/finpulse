const ALLOWED_TAGS = new Set([
  'h2',
  'p',
  'strong',
  'em',
  'ul',
  'ol',
  'li',
  'blockquote',
  'br',
]);

const BLOCKED_TAGS = /<(script|style|iframe|object|embed|svg|math)[\s\S]*?<\/\1>/gi;

export function isPulseHtmlFragment(html: string): boolean {
  return /<\/?[a-z][\w:-]*(?:\s[^>]*)?>/i.test(html);
}

function stripTagAttributes(tag: string): string {
  return tag.replace(/\s+[a-zA-Z0-9:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?/g, '');
}

export function sanitizePulseHtml(html: string): string {
  const withoutBlocked = html.replace(BLOCKED_TAGS, '');

  return withoutBlocked.replace(/<\/?([a-zA-Z0-9-]+)([^>]*)>/g, (match, tagName, attrs) => {
    const normalizedTag = String(tagName).toLowerCase();
    if (!ALLOWED_TAGS.has(normalizedTag)) {
      return '';
    }

    if (normalizedTag === 'br') {
      return '<br />';
    }

    if (match.startsWith('</')) {
      return `</${normalizedTag}>`;
    }

    return `<${normalizedTag}${stripTagAttributes(String(attrs))}>`;
  });
}
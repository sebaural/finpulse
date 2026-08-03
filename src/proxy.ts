import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getPrisma } from '@/lib/db';

const TABLE = {
  geopolitics: 'geopoliticsArticle',
  markets: 'marketsArticle',
  tech: 'techArticle',
} as const;

export async function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  const match = url.pathname.match(/^\/(geopolitics|markets|tech)\/([a-zA-Z0-9_-]+)$/);
  if (!match) return NextResponse.next();

  const [, section, slug] = match as [string, keyof typeof TABLE, string];

  try {
    const prisma = getPrisma();
    const row = await (prisma[TABLE[section]] as any).findFirst({
      where: { slug },
      select: { topic: { select: { slug: true } } },
    });
    if (row?.topic?.slug) {
      url.pathname = `/topics/${row.topic.slug}/${slug}`;
      return NextResponse.redirect(url, 301);
    }
  } catch (error) {
    console.error(`proxy: topic lookup failed for "${section}/${slug}"`, error);
  }

  return NextResponse.next();
}

export const proxyConfig = {
  matcher: ['/geopolitics/:slug*', '/markets/:slug*', '/tech/:slug*'],
};

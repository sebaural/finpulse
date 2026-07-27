import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { formatDateSegment } from '@/lib/seo';

export async function GET() {
  const prisma = getPrisma();
  const articles = await prisma.overviewArticle.findMany({
    orderBy: { publishedDate: 'desc' },
    take: 50,
  });

  const payload = articles.map((a) => ({
    ...a,
    url: `/overview/${formatDateSegment(a.publishedDate)}/${a.slug}`,
  }));

  return NextResponse.json(payload);
}


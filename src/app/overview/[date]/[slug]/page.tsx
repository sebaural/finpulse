import { getPrisma } from '@/lib/db';

export default async function Page({
  params,
}: {
  params: Promise<{ date: string; slug: string }>;
}) {
  const { slug } = await params;
  const prisma = getPrisma();

  const article = await prisma.overviewArticle.findUnique({
    where: { slug },
  });

  if (!article) {
    // handle not-found
  }

  // ... render with existing layout/typography components for visual consistency
  // (reuse presentation components only, not the geopolitics data logic)
}


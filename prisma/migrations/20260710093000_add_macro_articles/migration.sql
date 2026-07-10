-- CreateTable
CREATE TABLE "macro_articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publishedDate" DATE NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "macro_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "macro_articles_slug_key" ON "macro_articles"("slug");

-- CreateIndex
CREATE INDEX "macro_articles_publishedDate_idx" ON "macro_articles"("publishedDate");

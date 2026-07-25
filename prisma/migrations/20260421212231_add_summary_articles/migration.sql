-- CreateTable
CREATE TABLE "summary_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "keyPoints" JSONB NOT NULL,
    "sourceArticles" JSONB NOT NULL,
    "region" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "summary_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "summary_articles_title_key" ON "summary_articles"("title");

-- CreateIndex
CREATE INDEX "summary_articles_date_idx" ON "summary_articles"("date");

-- CreateIndex
CREATE INDEX "summary_articles_createdAt_idx" ON "summary_articles"("createdAt");

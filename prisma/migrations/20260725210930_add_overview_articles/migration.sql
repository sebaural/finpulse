-- CreateTable
CREATE TABLE "OverviewArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sourceUrls" TEXT[],
    "category" TEXT NOT NULL DEFAULT 'daily-overview',
    "publishedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "model" TEXT NOT NULL DEFAULT 'meta-llama/Llama-3.1-8B-Instruct',

    CONSTRAINT "OverviewArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OverviewArticle_slug_key" ON "OverviewArticle"("slug");

-- CreateIndex
CREATE INDEX "OverviewArticle_publishedDate_idx" ON "OverviewArticle"("publishedDate");

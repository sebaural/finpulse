-- CreateTable
CREATE TABLE "overview_days" (
    "id" TEXT NOT NULL,
    "publishedDate" DATE NOT NULL,
    "context" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overview_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overview_blocks" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'meta-llama/Llama-3.1-8B-Instruct',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overview_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "overview_days_publishedDate_key" ON "overview_days"("publishedDate");

-- CreateIndex
CREATE INDEX "overview_blocks_category_idx" ON "overview_blocks"("category");

-- CreateIndex
CREATE UNIQUE INDEX "overview_blocks_dayId_category_key" ON "overview_blocks"("dayId", "category");

-- AddForeignKey
ALTER TABLE "overview_blocks" ADD CONSTRAINT "overview_blocks_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "overview_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameTable: retire the old article-per-row model. Its rows don't map
-- cleanly onto the new day+category shape (no LLM re-classification pass is
-- part of this migration), so they're preserved under a new name rather than
-- dropped, and simply fall out of Prisma's schema going forward.
ALTER TABLE "OverviewArticle" RENAME TO "overview_articles_legacy";

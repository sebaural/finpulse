-- Rename table (preserves all existing rows)
ALTER TABLE "summary_articles" RENAME TO "geopolitics_articles";

-- Rename existing constraints and indexes to match the new table name
ALTER TABLE "geopolitics_articles" RENAME CONSTRAINT "summary_articles_pkey" TO "geopolitics_articles_pkey";
ALTER INDEX "summary_articles_title_key" RENAME TO "geopolitics_articles_title_key";
ALTER INDEX "summary_articles_date_idx" RENAME TO "geopolitics_articles_date_idx";
ALTER INDEX "summary_articles_createdAt_idx" RENAME TO "geopolitics_articles_createdAt_idx";

-- Add slug column to geopolitics_articles
ALTER TABLE "geopolitics_articles" ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';

-- CreateIndex for geopolitics_articles slug
CREATE INDEX "geopolitics_articles_slug_idx" ON "geopolitics_articles"("slug");

-- Add slug column to markets_articles
ALTER TABLE "markets_articles" ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';

-- CreateIndex for markets_articles slug
CREATE INDEX "markets_articles_slug_idx" ON "markets_articles"("slug");

-- Add slug column to tech_articles
ALTER TABLE "tech_articles" ADD COLUMN "slug" TEXT NOT NULL DEFAULT '';

-- CreateIndex for tech_articles slug
CREATE INDEX "tech_articles_slug_idx" ON "tech_articles"("slug");

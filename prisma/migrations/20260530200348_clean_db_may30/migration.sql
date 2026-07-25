/*
  Warnings:

  - You are about to drop the `summary_articles` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE IF EXISTS "summary_articles";

-- CreateTable
CREATE TABLE "geopolitics_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL,
    "keyPoints" JSONB NOT NULL,
    "sourceArticles" JSONB NOT NULL,
    "region" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "geopolitics_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "markets_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL,
    "keyPoints" JSONB NOT NULL,
    "sourceArticles" JSONB NOT NULL,
    "region" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tech_articles" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL,
    "keyPoints" JSONB NOT NULL,
    "sourceArticles" JSONB NOT NULL,
    "region" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tech_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "xAccessToken" TEXT,
    "xRefreshToken" TEXT,
    "xTokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "geopolitics_articles_title_key" ON "geopolitics_articles"("title");

-- CreateIndex
CREATE INDEX "geopolitics_articles_date_idx" ON "geopolitics_articles"("date");

-- CreateIndex
CREATE INDEX "geopolitics_articles_createdAt_idx" ON "geopolitics_articles"("createdAt");

-- CreateIndex
CREATE INDEX "geopolitics_articles_slug_idx" ON "geopolitics_articles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "markets_articles_title_key" ON "markets_articles"("title");

-- CreateIndex
CREATE INDEX "markets_articles_date_idx" ON "markets_articles"("date");

-- CreateIndex
CREATE INDEX "markets_articles_createdAt_idx" ON "markets_articles"("createdAt");

-- CreateIndex
CREATE INDEX "markets_articles_slug_idx" ON "markets_articles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tech_articles_title_key" ON "tech_articles"("title");

-- CreateIndex
CREATE INDEX "tech_articles_date_idx" ON "tech_articles"("date");

-- CreateIndex
CREATE INDEX "tech_articles_createdAt_idx" ON "tech_articles"("createdAt");

-- CreateIndex
CREATE INDEX "tech_articles_slug_idx" ON "tech_articles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

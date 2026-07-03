-- CreateTable
CREATE TABLE "pulse_articles" (
    "id" TEXT NOT NULL,
    "pulseSlug" TEXT NOT NULL,
    "articleSlug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT,
    "sourceUrl" TEXT,
    "category" TEXT NOT NULL,
    "observedStart" TIMESTAMP(3),
    "observedEnd" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pulse_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pulse_articles_pulseSlug_idx" ON "pulse_articles"("pulseSlug");

-- CreateIndex
CREATE INDEX "pulse_articles_observedStart_idx" ON "pulse_articles"("observedStart");

-- CreateIndex
CREATE UNIQUE INDEX "pulse_articles_pulseSlug_articleSlug_key" ON "pulse_articles"("pulseSlug", "articleSlug");

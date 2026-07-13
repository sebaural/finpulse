-- Ensure one row per macro published date before adding uniqueness.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "publishedDate"
      ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC
    ) AS rn
  FROM "macro_articles"
)
DELETE FROM "macro_articles" m
USING ranked r
WHERE m.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS "macro_articles_publishedDate_idx";

-- Enforce one macro article per date.
CREATE UNIQUE INDEX "macro_articles_publishedDate_key" ON "macro_articles"("publishedDate");

-- Distinct /topics "storyline" copy. Additive and nullable: existing rows and
-- existing code are unaffected.
ALTER TABLE "geopolitics_articles" ADD COLUMN "topic_title" TEXT, ADD COLUMN "topic_summary" TEXT, ADD COLUMN "topic_key_points" JSONB;
ALTER TABLE "markets_articles" ADD COLUMN "topic_title" TEXT, ADD COLUMN "topic_summary" TEXT, ADD COLUMN "topic_key_points" JSONB;
ALTER TABLE "tech_articles" ADD COLUMN "topic_title" TEXT, ADD COLUMN "topic_summary" TEXT, ADD COLUMN "topic_key_points" JSONB;

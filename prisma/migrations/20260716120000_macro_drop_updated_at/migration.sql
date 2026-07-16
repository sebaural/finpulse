-- Drop the dead `updatedAt` column from macro_articles.
--
-- macro_articles rows are immutable (see the macro_articles_prevent_update
-- BEFORE UPDATE trigger): a row is inserted once and never updated, so
-- `updatedAt` could never diverge from `createdAt`. It carried no information
-- and is never surfaced to any read path. `createdAt` alone records write time.
--
-- DROP COLUMN is DDL, not a row UPDATE, so the immutability trigger does not fire.
ALTER TABLE "macro_articles" DROP COLUMN IF EXISTS "updatedAt";

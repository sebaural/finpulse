-- Make macro articles immutable after insert.
-- The macro landscape is generated once per NY date and must never be updated.

CREATE OR REPLACE FUNCTION prevent_macro_articles_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'macro_articles rows are immutable and cannot be updated';
END;
$$;

DROP TRIGGER IF EXISTS macro_articles_prevent_update ON "macro_articles";

CREATE TRIGGER macro_articles_prevent_update
BEFORE UPDATE ON "macro_articles"
FOR EACH ROW
EXECUTE FUNCTION prevent_macro_articles_update();

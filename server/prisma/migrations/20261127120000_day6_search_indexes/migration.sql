-- Enable trigram similarity extension for typo-tolerant and prefix matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Immutable wrapper around array_to_string (PG marks array_to_string STABLE by default)
CREATE OR REPLACE FUNCTION campusx_immutable_array_to_text(arr TEXT[], sep TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
AS $$ SELECT array_to_string(arr, sep); $$;

-- Weighted generated tsvector column: title (A), tags (B), description (C)
ALTER TABLE "products"
ADD COLUMN IF NOT EXISTS "searchVector" tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
  setweight(to_tsvector('english', coalesce(campusx_immutable_array_to_text("tags", ' '), '')), 'B') ||
  setweight(to_tsvector('english', coalesce("description", '')), 'C')
) STORED;

-- GIN index on full-text searchVector
CREATE INDEX IF NOT EXISTS "products_searchVector_gin_idx"
ON "products" USING GIN ("searchVector");

-- GIN trigram index on title for typo tolerance and prefix matching
CREATE INDEX IF NOT EXISTS "products_title_trgm_gin_idx"
ON "products" USING GIN ("title" gin_trgm_ops);

-- Composite B-tree indexes for filter & sort combinations
CREATE INDEX IF NOT EXISTS "products_status_categoryId_price_idx"
ON "products" ("status", "categoryId", "price");

CREATE INDEX IF NOT EXISTS "products_status_publishedAt_idx"
ON "products" ("status", "publishedAt");

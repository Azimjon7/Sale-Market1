CREATE INDEX IF NOT EXISTS products_catalog_newest_idx
  ON products (created_at DESC, id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS products_catalog_category_idx
  ON products (lower(category), created_at DESC, id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS products_catalog_price_idx
  ON products (price, id) WHERE deleted_at IS NULL;

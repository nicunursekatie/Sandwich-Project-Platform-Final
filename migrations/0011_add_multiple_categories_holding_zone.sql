-- Add junction table for multiple categories on holding zone items
CREATE TABLE IF NOT EXISTS "team_board_item_categories" (
  "id" serial PRIMARY KEY NOT NULL,
  "item_id" integer NOT NULL REFERENCES "team_board_items"("id") ON DELETE CASCADE,
  "category_id" integer NOT NULL REFERENCES "holding_zone_categories"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "team_board_item_categories_item_id_category_id_unique" UNIQUE("item_id", "category_id")
);

-- Migrate existing category_id data to the junction table
INSERT INTO "team_board_item_categories" ("item_id", "category_id")
SELECT "id", "category_id" FROM "team_board_items" WHERE "category_id" IS NOT NULL;

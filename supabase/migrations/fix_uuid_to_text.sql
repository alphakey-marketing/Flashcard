-- Migration: Change ID columns from UUID to TEXT to support custom string IDs
-- This fixes the "invalid input syntax for type uuid" error

-- Step 1: Drop foreign key constraints
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_deck_id_fkey;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_deck_id_fkey;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_card_id_fkey;

-- Step 2: Change column types
ALTER TABLE decks ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE cards ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE cards ALTER COLUMN deck_id TYPE TEXT USING deck_id::TEXT;
ALTER TABLE reviews ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE reviews ALTER COLUMN card_id TYPE TEXT USING card_id::TEXT;
ALTER TABLE reviews ALTER COLUMN deck_id TYPE TEXT USING deck_id::TEXT;

-- Step 3: Re-add foreign key constraints
ALTER TABLE cards 
  ADD CONSTRAINT cards_deck_id_fkey 
  FOREIGN KEY (deck_id) 
  REFERENCES decks(id) 
  ON DELETE CASCADE;

ALTER TABLE reviews 
  ADD CONSTRAINT reviews_deck_id_fkey 
  FOREIGN KEY (deck_id) 
  REFERENCES decks(id) 
  ON DELETE CASCADE;

ALTER TABLE reviews 
  ADD CONSTRAINT reviews_card_id_fkey 
  FOREIGN KEY (card_id) 
  REFERENCES cards(id) 
  ON DELETE CASCADE;

-- Step 4: Update indexes if any exist
DROP INDEX IF EXISTS decks_user_id_idx;
CREATE INDEX decks_user_id_idx ON decks(user_id);

DROP INDEX IF EXISTS cards_deck_id_idx;
CREATE INDEX cards_deck_id_idx ON cards(deck_id);

DROP INDEX IF EXISTS reviews_user_id_idx;
CREATE INDEX reviews_user_id_idx ON reviews(user_id);

DROP INDEX IF EXISTS reviews_card_id_idx;
CREATE INDEX reviews_card_id_idx ON reviews(card_id);

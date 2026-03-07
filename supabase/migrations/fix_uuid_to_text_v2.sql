-- Migration v2: Change ID columns from UUID to TEXT (with RLS policy handling)
-- This fixes the "invalid input syntax for type uuid" error

-- Step 1: Drop all RLS policies that depend on these columns
DROP POLICY IF EXISTS "Users can view their own decks" ON decks;
DROP POLICY IF EXISTS "Users can insert their own decks" ON decks;
DROP POLICY IF EXISTS "Users can update their own decks" ON decks;
DROP POLICY IF EXISTS "Users can delete their own decks" ON decks;

DROP POLICY IF EXISTS "Users can view cards of their decks" ON cards;
DROP POLICY IF EXISTS "Users can insert cards to their decks" ON cards;
DROP POLICY IF EXISTS "Users can update cards of their decks" ON cards;
DROP POLICY IF EXISTS "Users can delete cards of their decks" ON cards;

DROP POLICY IF EXISTS "Users can view their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can insert their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON reviews;

-- Step 2: Drop foreign key constraints
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_deck_id_fkey;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_deck_id_fkey;
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_card_id_fkey;

-- Step 3: Change column types from UUID to TEXT
ALTER TABLE decks ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE cards ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE cards ALTER COLUMN deck_id TYPE TEXT USING deck_id::TEXT;
ALTER TABLE reviews ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE reviews ALTER COLUMN card_id TYPE TEXT USING card_id::TEXT;
ALTER TABLE reviews ALTER COLUMN deck_id TYPE TEXT USING deck_id::TEXT;

-- Step 4: Re-add foreign key constraints
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

-- Step 5: Recreate RLS policies for decks table
CREATE POLICY "Users can view their own decks" 
  ON decks FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own decks" 
  ON decks FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own decks" 
  ON decks FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own decks" 
  ON decks FOR DELETE 
  USING (auth.uid() = user_id);

-- Step 6: Recreate RLS policies for cards table
CREATE POLICY "Users can view cards of their decks" 
  ON cards FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM decks 
      WHERE decks.id = cards.deck_id 
      AND decks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert cards to their decks" 
  ON cards FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM decks 
      WHERE decks.id = cards.deck_id 
      AND decks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update cards of their decks" 
  ON cards FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM decks 
      WHERE decks.id = cards.deck_id 
      AND decks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete cards of their decks" 
  ON cards FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM decks 
      WHERE decks.id = cards.deck_id 
      AND decks.user_id = auth.uid()
    )
  );

-- Step 7: Recreate RLS policies for reviews table
CREATE POLICY "Users can view their own reviews" 
  ON reviews FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reviews" 
  ON reviews FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews" 
  ON reviews FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews" 
  ON reviews FOR DELETE 
  USING (auth.uid() = user_id);

-- Step 8: Recreate indexes for performance
DROP INDEX IF EXISTS decks_user_id_idx;
CREATE INDEX decks_user_id_idx ON decks(user_id);

DROP INDEX IF EXISTS cards_deck_id_idx;
CREATE INDEX cards_deck_id_idx ON cards(deck_id);

DROP INDEX IF EXISTS reviews_user_id_idx;
CREATE INDEX reviews_user_id_idx ON reviews(user_id);

DROP INDEX IF EXISTS reviews_card_id_idx;
CREATE INDEX reviews_card_id_idx ON reviews(card_id);

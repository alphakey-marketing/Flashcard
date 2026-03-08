-- Cleanup and Fix RLS Policies for FlashMind
-- This script first removes ALL existing policies, then creates fresh ones
-- Safe to run even if policies don't exist (uses IF EXISTS)

-- ============================================
-- STEP 1: Remove ALL existing policies
-- ============================================

-- Drop DECKS policies
DROP POLICY IF EXISTS "Users can insert their own decks" ON public.decks;
DROP POLICY IF EXISTS "Users can view their own decks" ON public.decks;
DROP POLICY IF EXISTS "Users can update their own decks" ON public.decks;
DROP POLICY IF EXISTS "Users can delete their own decks" ON public.decks;

-- Drop CARDS policies
DROP POLICY IF EXISTS "Users can insert cards to their decks" ON public.cards;
DROP POLICY IF EXISTS "Users can view cards of their decks" ON public.cards;
DROP POLICY IF EXISTS "Users can update cards of their decks" ON public.cards;
DROP POLICY IF EXISTS "Users can delete cards of their decks" ON public.cards;

-- Drop REVIEWS policies
DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can view their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;

-- Drop STUDY_SESSIONS policies (if they exist)
DROP POLICY IF EXISTS "Users can insert their own study sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Users can view their own study sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Users can update their own study sessions" ON public.study_sessions;
DROP POLICY IF EXISTS "Users can delete their own study sessions" ON public.study_sessions;

SELECT 'All existing policies dropped successfully!' as status;

-- ============================================
-- STEP 2: Ensure RLS is enabled
-- ============================================

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

SELECT 'RLS enabled on all tables!' as status;

-- ============================================
-- STEP 3: Create fresh DECKS policies
-- ============================================

CREATE POLICY "Users can insert their own decks"
ON public.decks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own decks"
ON public.decks
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own decks"
ON public.decks
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own decks"
ON public.decks
FOR DELETE
USING (auth.uid() = user_id);

SELECT 'Decks policies created!' as status;

-- ============================================
-- STEP 4: Create fresh CARDS policies
-- ============================================

CREATE POLICY "Users can insert cards to their decks"
ON public.cards
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE id = cards.deck_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can view cards of their decks"
ON public.cards
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE id = cards.deck_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update cards of their decks"
ON public.cards
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE id = cards.deck_id 
    AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE id = cards.deck_id 
    AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete cards of their decks"
ON public.cards
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE id = cards.deck_id 
    AND user_id = auth.uid()
  )
);

SELECT 'Cards policies created!' as status;

-- ============================================
-- STEP 5: Create fresh REVIEWS policies
-- ============================================

CREATE POLICY "Users can insert their own reviews"
ON public.reviews
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reviews"
ON public.reviews
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
ON public.reviews
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
ON public.reviews
FOR DELETE
USING (auth.uid() = user_id);

SELECT 'Reviews policies created!' as status;

-- ============================================
-- STEP 6: Verify all policies are created
-- ============================================

SELECT 
  tablename,
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
ORDER BY tablename, cmd, policyname;

SELECT '✅ All policies recreated successfully! You should see 16 policies above.' as final_status;

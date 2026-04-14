-- Fix RLS Policies for FlashMind Sync Error
-- Run this in Supabase SQL Editor to fix the "row violates row-level security policy" error

-- ============================================
-- STEP 1: Clean up existing policies (if any)
-- ============================================

DROP POLICY IF EXISTS "Users can insert their own decks" ON public.decks;
DROP POLICY IF EXISTS "Users can view their own decks" ON public.decks;
DROP POLICY IF EXISTS "Users can update their own decks" ON public.decks;
DROP POLICY IF EXISTS "Users can delete their own decks" ON public.decks;

DROP POLICY IF EXISTS "Users can insert cards to their decks" ON public.cards;
DROP POLICY IF EXISTS "Users can view cards of their decks" ON public.cards;
DROP POLICY IF EXISTS "Users can update cards of their decks" ON public.cards;
DROP POLICY IF EXISTS "Users can delete cards of their decks" ON public.cards;

DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can view their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;

-- ============================================
-- STEP 2: Ensure RLS is enabled
-- ============================================

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 3: Create correct DECKS policies
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

-- ============================================
-- STEP 4: Create correct CARDS policies
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

-- ============================================
-- STEP 5: Create correct REVIEWS policies
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

-- ============================================
-- STEP 6: Verify the policies
-- ============================================

-- Check all policies are created correctly
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
ORDER BY tablename, policyname;

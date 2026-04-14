-- FINAL RLS POLICY FIX
-- This is the definitive, correct setup for RLS policies
-- Run this script in Supabase SQL Editor

-- ============================================
-- STEP 1: Clean slate - remove ALL policies
-- ============================================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename IN ('decks', 'cards', 'reviews', 'study_sessions')
    ) LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
        RAISE NOTICE 'Dropped: %.%', r.tablename, r.policyname;
    END LOOP;
END $$;

SELECT '✅ All existing policies removed' as status;

-- ============================================
-- STEP 2: Ensure RLS is enabled
-- ============================================
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

SELECT '✅ RLS enabled on all tables' as status;

-- ============================================
-- STEP 3: DECKS policies (CORRECT)
-- ============================================

-- SELECT: Users can view their own decks
CREATE POLICY "decks_select"
ON public.decks
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT: Users can insert decks with their user_id
CREATE POLICY "decks_insert"
ON public.decks
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own decks
CREATE POLICY "decks_update"
ON public.decks
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own decks
CREATE POLICY "decks_delete"
ON public.decks
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

SELECT '✅ Created 4 policies for decks table' as status;

-- ============================================
-- STEP 4: CARDS policies (CORRECT)
-- ============================================

-- SELECT: Users can view cards from their decks
CREATE POLICY "cards_select"
ON public.cards
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.decks
    WHERE decks.id = cards.deck_id
    AND decks.user_id = auth.uid()
  )
);

-- INSERT: Users can insert cards to their decks
CREATE POLICY "cards_insert"
ON public.cards
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.decks
    WHERE decks.id = cards.deck_id
    AND decks.user_id = auth.uid()
  )
);

-- UPDATE: Users can update cards in their decks
CREATE POLICY "cards_update"
ON public.cards
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.decks
    WHERE decks.id = cards.deck_id
    AND decks.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.decks
    WHERE decks.id = cards.deck_id
    AND decks.user_id = auth.uid()
  )
);

-- DELETE: Users can delete cards from their decks
CREATE POLICY "cards_delete"
ON public.cards
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.decks
    WHERE decks.id = cards.deck_id
    AND decks.user_id = auth.uid()
  )
);

SELECT '✅ Created 4 policies for cards table' as status;

-- ============================================
-- STEP 5: REVIEWS policies (CORRECT)
-- ============================================

-- SELECT: Users can view their own reviews
CREATE POLICY "reviews_select"
ON public.reviews
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- INSERT: Users can insert their own reviews
CREATE POLICY "reviews_insert"
ON public.reviews
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE: Users can update their own reviews
CREATE POLICY "reviews_update"
ON public.reviews
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE: Users can delete their own reviews
CREATE POLICY "reviews_delete"
ON public.reviews
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

SELECT '✅ Created 4 policies for reviews table' as status;

-- ============================================
-- STEP 6: Verification
-- ============================================

-- Show all policies
SELECT 
  '📊 Policy Summary' as info,
  tablename,
  policyname,
  cmd as operation,
  roles
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
ORDER BY tablename, cmd;

-- Count policies per table
SELECT 
  '📈 Policy Count' as info,
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) = 4 THEN '✅ CORRECT'
    ELSE '❌ WRONG'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
GROUP BY tablename
ORDER BY tablename;

-- Verify RLS is enabled
SELECT 
  '🔒 RLS Status' as info,
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
ORDER BY tablename;

SELECT '

✅✅✅ RLS POLICIES CONFIGURED CORRECTLY! ✅✅✅

You should see:
- 12 total policies (4 per table)
- RLS ENABLED on all 3 tables
- All policies target "authenticated" role

Next steps:
1. Make sure you delete all old data from tables (if any)
2. Use the NEW code on "rebuild-sync-from-scratch" branch
3. Test with a fresh account

' as final_message;

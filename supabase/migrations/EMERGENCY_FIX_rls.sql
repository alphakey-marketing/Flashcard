-- EMERGENCY FIX FOR RLS POLICY ERRORS
-- This script will completely reset and fix all RLS policies

-- ============================================
-- STEP 1: Show current state
-- ============================================
SELECT 'BEFORE FIX - Current state' as step;

SELECT 
  tablename,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
GROUP BY tablename;

-- ============================================
-- STEP 2: Disable RLS temporarily (for testing)
-- UNCOMMENT THESE LINES IF YOU WANT TO TEST WITHOUT RLS
-- ============================================
-- ALTER TABLE public.decks DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.cards DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.reviews DISABLE ROW LEVEL SECURITY;
-- SELECT 'RLS DISABLED FOR TESTING - Remember to re-enable!' as warning;

-- ============================================
-- STEP 3: Drop ALL existing policies
-- ============================================
SELECT 'Dropping all existing policies...' as step;

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
        RAISE NOTICE 'Dropped policy: % on table %', r.policyname, r.tablename;
    END LOOP;
END $$;

SELECT '✅ All policies dropped' as status;

-- ============================================
-- STEP 4: Ensure RLS is enabled
-- ============================================
SELECT 'Enabling RLS on all tables...' as step;

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

SELECT '✅ RLS enabled' as status;

-- ============================================
-- STEP 5: Create SIMPLE policies (most permissive)
-- ============================================
SELECT 'Creating new policies...' as step;

-- DECKS POLICIES
CREATE POLICY "decks_select"
ON public.decks FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "decks_insert"
ON public.decks FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "decks_update"
ON public.decks FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "decks_delete"
ON public.decks FOR DELETE
USING (user_id = auth.uid());

SELECT '✅ Decks policies created' as status;

-- CARDS POLICIES
CREATE POLICY "cards_select"
ON public.cards FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE decks.id = cards.deck_id 
    AND decks.user_id = auth.uid()
  )
);

CREATE POLICY "cards_insert"
ON public.cards FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE decks.id = cards.deck_id 
    AND decks.user_id = auth.uid()
  )
);

CREATE POLICY "cards_update"
ON public.cards FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE decks.id = cards.deck_id 
    AND decks.user_id = auth.uid()
  )
);

CREATE POLICY "cards_delete"
ON public.cards FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE decks.id = cards.deck_id 
    AND decks.user_id = auth.uid()
  )
);

SELECT '✅ Cards policies created' as status;

-- REVIEWS POLICIES
CREATE POLICY "reviews_select"
ON public.reviews FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "reviews_insert"
ON public.reviews FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "reviews_update"
ON public.reviews FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "reviews_delete"
ON public.reviews FOR DELETE
USING (user_id = auth.uid());

SELECT '✅ Reviews policies created' as status;

-- ============================================
-- STEP 6: Verify all policies
-- ============================================
SELECT 'AFTER FIX - Verification' as step;

SELECT 
  tablename,
  policyname,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING'
    ELSE 'No USING'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK'
    ELSE 'No WITH CHECK'
  END as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
ORDER BY tablename, cmd;

-- Count policies
SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) = 4 THEN '✅ CORRECT'
    ELSE '❌ WRONG'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
GROUP BY tablename;

-- ============================================
-- STEP 7: Show the exact INSERT policy
-- ============================================
SELECT 'CRITICAL CHECK - decks INSERT policy' as step;

SELECT 
  policyname,
  with_check as insert_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'decks'
AND cmd = 'INSERT';

-- Expected: (user_id = auth.uid())

SELECT '✅ FIX COMPLETE! You should see 12 policies (4 per table)' as final_message;
SELECT 'If auth.uid() test returns NULL in SQL Editor, that is NORMAL - it will work in your app!' as note;

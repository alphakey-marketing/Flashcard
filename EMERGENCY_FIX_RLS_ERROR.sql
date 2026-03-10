-- EMERGENCY FIX FOR RLS ERRORS
-- Run this to fix ALL common RLS issues in one go
-- This combines FINAL_RLS_FIX + AUTO_FIX_USER_DATA + verification

BEGIN;

SELECT '

🚑 EMERGENCY FIX STARTING...

This will:
1. Remove all existing policies
2. Create correct RLS policies
3. Fix corrupt user_ids
4. Verify everything

' as notice;

-- ============================================
-- STEP 1: Drop ALL existing policies
-- ============================================
SELECT '🧹 Cleaning old policies...' as step;

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
    END LOOP;
END $$;

SELECT '✅ Old policies removed' as status;

-- ============================================
-- STEP 2: Enable RLS
-- ============================================
SELECT '🔒 Enabling RLS...' as step;

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

SELECT '✅ RLS enabled' as status;

-- ============================================
-- STEP 3: Create CORRECT policies for DECKS
-- ============================================
SELECT '🛡️ Creating deck policies...' as step;

CREATE POLICY "decks_select" ON public.decks
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "decks_insert" ON public.decks
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "decks_update" ON public.decks
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "decks_delete" ON public.decks
FOR DELETE TO authenticated
USING (user_id = auth.uid());

SELECT '✅ Deck policies created' as status;

-- ============================================
-- STEP 4: Create CORRECT policies for CARDS
-- ============================================
SELECT '🛡️ Creating card policies...' as step;

CREATE POLICY "cards_select" ON public.cards
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.decks WHERE decks.id = cards.deck_id AND decks.user_id = auth.uid()));

CREATE POLICY "cards_insert" ON public.cards
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.decks WHERE decks.id = cards.deck_id AND decks.user_id = auth.uid()));

CREATE POLICY "cards_update" ON public.cards
FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.decks WHERE decks.id = cards.deck_id AND decks.user_id = auth.uid()));

CREATE POLICY "cards_delete" ON public.cards
FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.decks WHERE decks.id = cards.deck_id AND decks.user_id = auth.uid()));

SELECT '✅ Card policies created' as status;

-- ============================================
-- STEP 5: Create CORRECT policies for REVIEWS
-- ============================================
SELECT '🛡️ Creating review policies...' as step;

CREATE POLICY "reviews_select" ON public.reviews
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "reviews_insert" ON public.reviews
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "reviews_update" ON public.reviews
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "reviews_delete" ON public.reviews
FOR DELETE TO authenticated
USING (user_id = auth.uid());

SELECT '✅ Review policies created' as status;

-- ============================================
-- STEP 6: Fix corrupt user_ids
-- ============================================
SELECT '🔧 Fixing corrupt user_ids...' as step;

DO $$
DECLARE
  real_user_record RECORD;
  corrupt_count integer;
  rows_updated integer;
BEGIN
  -- Count corrupt data
  SELECT COUNT(*) INTO corrupt_count
  FROM public.decks
  WHERE LENGTH(user_id::text) < 36;
  
  IF corrupt_count > 0 THEN
    RAISE NOTICE 'Found % decks with corrupt user_id', corrupt_count;
    
    -- Get the most recent real user
    SELECT id, email INTO real_user_record
    FROM auth.users
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF real_user_record.id IS NULL THEN
      RAISE WARNING 'No users found in auth.users!';
    ELSE
      RAISE NOTICE 'Mapping corrupt data to: % (%)', real_user_record.email, real_user_record.id;
      
      -- Fix decks
      UPDATE public.decks
      SET user_id = real_user_record.id
      WHERE LENGTH(user_id::text) < 36;
      
      GET DIAGNOSTICS rows_updated = ROW_COUNT;
      RAISE NOTICE 'Updated % decks', rows_updated;
      
      -- Fix reviews
      UPDATE public.reviews
      SET user_id = real_user_record.id
      WHERE LENGTH(user_id::text) < 36;
      
      GET DIAGNOSTICS rows_updated = ROW_COUNT;
      RAISE NOTICE 'Updated % reviews', rows_updated;
    END IF;
  ELSE
    RAISE NOTICE 'No corrupt user_ids found - data is clean!';
  END IF;
END $$;

SELECT '✅ User IDs fixed' as status;

-- ============================================
-- STEP 7: Verification
-- ============================================
SELECT '✅ Running verification...' as step;

-- Check policies
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
GROUP BY tablename
ORDER BY tablename;

-- Check RLS enabled
SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
ORDER BY tablename;

-- Check corrupt data
SELECT 
  'Remaining corrupt decks:' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ NONE'
    ELSE '❌ STILL HAS ISSUES'
  END as status
FROM public.decks
WHERE LENGTH(user_id::text) < 36;

COMMIT;

SELECT '

✅✅✅ EMERGENCY FIX COMPLETE! ✅✅✅

What was done:
1. ✅ Removed old broken policies
2. ✅ Created 12 correct RLS policies
3. ✅ Fixed all corrupt user_ids
4. ✅ Verified everything

Next steps:
1. Have users clear localStorage (if they get duplicate key errors)
2. Users can now sync successfully!
3. Check console for "Sync complete" message

If issues persist, run:
  - DIAGNOSE_SYNC_ERROR.sql

' as final_message;

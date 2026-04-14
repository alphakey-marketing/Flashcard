-- TEMPORARY WORKAROUND: DISABLE RLS FOR TESTING
-- This will let you test if the app works without RLS
-- WARNING: Your data will be publicly accessible while RLS is disabled!

-- ============================================
-- STEP 1: Show current state
-- ============================================
SELECT 'Current RLS status:' as info;

SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN 'ENABLED'
    ELSE 'DISABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
ORDER BY tablename;

-- ============================================
-- STEP 2: DISABLE RLS (temporary for testing)
-- ============================================
SELECT 'Disabling RLS on all tables...' as action;

ALTER TABLE public.decks DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews DISABLE ROW LEVEL SECURITY;

SELECT '⚠️ RLS DISABLED - All tables are now publicly accessible!' as warning;
SELECT 'This is ONLY for testing. You MUST re-enable RLS after testing!' as important;

-- ============================================
-- STEP 3: Verify RLS is disabled
-- ============================================
SELECT 'Verification:' as info;

SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '❌ Still ENABLED'
    ELSE '✅ DISABLED'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
ORDER BY tablename;

SELECT '✅ RLS is now DISABLED. Test your app with a new account.' as next_step;
SELECT 'If sync works now, the problem is definitely the RLS policies.' as diagnosis;

-- ============================================
-- TO RE-ENABLE RLS AFTER TESTING:
-- Run these commands:
-- ============================================
-- ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

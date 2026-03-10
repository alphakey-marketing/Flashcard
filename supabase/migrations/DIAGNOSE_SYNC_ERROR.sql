-- DIAGNOSE SYNC ERROR
-- Run this to find out exactly why sync is failing

\echo ''
\echo '================================================================='
\echo 'DIAGNOSTIC REPORT: Sync Error Investigation'
\echo '================================================================='
\echo ''

-- ============================================
-- TEST 1: Check RLS is enabled
-- ============================================
\echo 'TEST 1: Checking if RLS is enabled...'
\echo ''

SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ ENABLED'
    ELSE '❌ DISABLED - THIS IS THE PROBLEM!'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
ORDER BY tablename;

\echo ''
\echo 'Expected: All 3 tables should show ✅ ENABLED'
\echo ''

-- ============================================
-- TEST 2: Check RLS policies exist
-- ============================================
\echo 'TEST 2: Checking RLS policies...'
\echo ''

SELECT 
  tablename,
  policyname,
  cmd as operation,
  roles,
  CASE 
    WHEN 'authenticated' = ANY(roles::text[]) THEN '✅ Has authenticated role'
    ELSE '❌ Missing authenticated role - THIS IS THE PROBLEM!'
  END as role_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
ORDER BY tablename, cmd;

\echo ''
\echo 'Expected: Should see 12 policies (4 per table), all with ✅'
\echo ''

-- Count policies
SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) = 4 THEN '✅ CORRECT'
    ELSE '❌ WRONG COUNT - Should be 4'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
GROUP BY tablename
ORDER BY tablename;

\echo ''

-- ============================================
-- TEST 3: Check for corrupt user_ids
-- ============================================
\echo 'TEST 3: Checking for corrupt user_ids in data...'
\echo ''

SELECT 
  'Decks with corrupt user_id:' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ NONE (Good!)'
    ELSE '❌ FOUND CORRUPT DATA - THIS IS THE PROBLEM!'
  END as status
FROM public.decks
WHERE LENGTH(user_id::text) < 36;

SELECT 
  'Reviews with corrupt user_id:' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ NONE (Good!)'
    ELSE '❌ FOUND CORRUPT DATA - THIS IS THE PROBLEM!'
  END as status
FROM public.reviews
WHERE LENGTH(user_id::text) < 36;

\echo ''
\echo 'Expected: Both should show ✅ NONE'
\echo ''

-- Show sample of corrupt data if any
WITH corrupt_decks AS (
  SELECT 
    user_id,
    LENGTH(user_id::text) as length,
    COUNT(*) as deck_count
  FROM public.decks
  WHERE LENGTH(user_id::text) < 36
  GROUP BY user_id, LENGTH(user_id::text)
  LIMIT 5
)
SELECT 
  '❌ CORRUPT USER_IDS FOUND:' as warning,
  user_id,
  length as user_id_length,
  deck_count
FROM corrupt_decks;

\echo ''

-- ============================================
-- TEST 4: Check valid users exist
-- ============================================
\echo 'TEST 4: Checking auth.users...'
\echo ''

SELECT 
  'Total users in auth.users:' as info,
  COUNT(*) as user_count
FROM auth.users;

SELECT 
  id as user_id,
  email,
  LENGTH(id::text) as id_length,
  CASE 
    WHEN LENGTH(id::text) = 36 THEN '✅ Valid UUID'
    ELSE '❌ Invalid'
  END as status,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

\echo ''
\echo 'Expected: All users should have ✅ Valid UUID (36 chars)'
\echo ''

-- ============================================
-- TEST 5: Check policy expressions
-- ============================================
\echo 'TEST 5: Checking policy expressions...'
\echo ''

SELECT 
  tablename,
  policyname,
  cmd,
  qual as using_expression,
  with_check as with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'decks'
ORDER BY cmd;

\echo ''
\echo 'Expected: Should see (user_id = auth.uid()) in expressions'
\echo ''

-- ============================================
-- TEST 6: Test auth.uid() function
-- ============================================
\echo 'TEST 6: Testing auth.uid() function...'
\echo ''

SELECT 
  CASE 
    WHEN auth.uid() IS NOT NULL THEN 
      '⚠️  You are authenticated in SQL Editor as: ' || auth.uid()::text
    ELSE 
      '✅ NULL (Normal - you are not authenticated in SQL Editor)'
  END as auth_test,
  'This will work in the app when users are logged in' as note;

\echo ''

-- ============================================
-- DIAGNOSIS SUMMARY
-- ============================================
\echo ''
\echo '================================================================='
\echo 'DIAGNOSIS SUMMARY'
\echo '================================================================='
\echo ''

DO $$
DECLARE
  rls_disabled_count int;
  missing_policies_count int;
  corrupt_user_ids_count int;
  diagnosis text := '';
BEGIN
  -- Check RLS disabled
  SELECT COUNT(*) INTO rls_disabled_count
  FROM pg_tables
  WHERE schemaname = 'public'
  AND tablename IN ('decks', 'cards', 'reviews')
  AND rowsecurity = false;
  
  -- Check missing policies
  SELECT COUNT(*) INTO missing_policies_count
  FROM (
    SELECT tablename, COUNT(*) as cnt
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN ('decks', 'cards', 'reviews')
    GROUP BY tablename
    HAVING COUNT(*) < 4
  ) sub;
  
  -- Check corrupt user_ids
  SELECT COUNT(*) INTO corrupt_user_ids_count
  FROM public.decks
  WHERE LENGTH(user_id::text) < 36;
  
  -- Build diagnosis
  IF rls_disabled_count > 0 THEN
    diagnosis := diagnosis || E'\n❌ PROBLEM 1: RLS is DISABLED on ' || rls_disabled_count || ' table(s)';
    diagnosis := diagnosis || E'\n   FIX: Run FINAL_RLS_FIX.sql';
  END IF;
  
  IF missing_policies_count > 0 THEN
    diagnosis := diagnosis || E'\n❌ PROBLEM 2: Missing or incomplete RLS policies';
    diagnosis := diagnosis || E'\n   FIX: Run FINAL_RLS_FIX.sql';
  END IF;
  
  IF corrupt_user_ids_count > 0 THEN
    diagnosis := diagnosis || E'\n❌ PROBLEM 3: Found ' || corrupt_user_ids_count || ' decks with corrupt user_id';
    diagnosis := diagnosis || E'\n   FIX: Run AUTO_FIX_USER_DATA.sql';
  END IF;
  
  IF rls_disabled_count = 0 AND missing_policies_count = 0 AND corrupt_user_ids_count = 0 THEN
    diagnosis := E'\n✅ ALL CHECKS PASSED!';
    diagnosis := diagnosis || E'\n\nIf sync still fails, the issue is likely:';
    diagnosis := diagnosis || E'\n1. User session not being sent properly from app';
    diagnosis := diagnosis || E'\n2. User trying to access someone else\'s data';
    diagnosis := diagnosis || E'\n3. Check browser console for actual user ID';
  END IF;
  
  RAISE NOTICE '%', diagnosis;
END $$;

\echo ''
\echo '================================================================='
\echo 'END OF DIAGNOSTIC REPORT'
\echo '================================================================='
\echo ''
\echo 'Next steps:'
\echo '1. Fix any ❌ PROBLEMS shown above'
\echo '2. Re-run this diagnostic to verify fixes'
\echo '3. Test sync again'
\echo ''

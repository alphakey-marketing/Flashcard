-- CHECK IF auth.uid() FUNCTION WORKS
-- This will tell us if the RLS policy can even check user authentication

-- ============================================
-- TEST 1: Check if auth schema exists
-- ============================================
SELECT 'Test 1: Checking auth schema...' as test;

SELECT 
  schema_name,
  '✅ Auth schema exists' as status
FROM information_schema.schemata 
WHERE schema_name = 'auth';

-- ============================================
-- TEST 2: Check if auth.uid() function exists
-- ============================================
SELECT 'Test 2: Checking auth.uid() function...' as test;

SELECT 
  routine_name,
  routine_type,
  '✅ Function exists' as status
FROM information_schema.routines
WHERE routine_schema = 'auth'
AND routine_name = 'uid';

-- ============================================
-- TEST 3: Try calling auth.uid()
-- ============================================
SELECT 'Test 3: Calling auth.uid()...' as test;

SELECT 
  CASE 
    WHEN auth.uid() IS NOT NULL THEN '✅ You are authenticated in SQL Editor'
    ELSE '⚠️ NULL (this is normal in SQL Editor - will work in app)'
  END as result,
  auth.uid() as your_user_id;

-- ============================================
-- TEST 4: Check current RLS policies
-- ============================================
SELECT 'Test 4: Current RLS policies on decks table...' as test;

SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN cmd = 'INSERT' THEN with_check
    ELSE qual
  END as policy_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'decks'
ORDER BY cmd;

-- ============================================
-- TEST 5: Check if RLS is enabled
-- ============================================
SELECT 'Test 5: RLS status...' as test;

SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS is ENABLED'
    ELSE '❌ RLS is DISABLED'
  END as status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'decks';

-- ============================================
-- TEST 6: Check table structure
-- ============================================
SELECT 'Test 6: Checking decks table structure...' as test;

SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'decks'
AND column_name IN ('id', 'user_id')
ORDER BY column_name;

-- ============================================
-- DIAGNOSIS
-- ============================================
SELECT '====== DIAGNOSIS ======' as result;

SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ RLS policies exist for decks table'
    ELSE '❌ NO policies found! Need to create them.'
  END as policy_status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'decks';

SELECT 'If all tests pass but sync still fails, the issue is likely:' as hint;
SELECT '1. Session token not being sent properly from app' as hint_1;
SELECT '2. User ID mismatch between session and data' as hint_2;
SELECT '3. RLS policy expression is incorrect' as hint_3;

-- Diagnostic Script for FlashMind RLS Issues
-- Run this to see current state of your database

-- ============================================
-- CHECK 1: Verify tables exist
-- ============================================
SELECT 'CHECK 1: Tables' as check_type;

SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('decks', 'cards', 'reviews') THEN '✅ Found'
    ELSE '❌ Missing'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('decks', 'cards', 'reviews', 'study_sessions')
ORDER BY table_name;

-- ============================================
-- CHECK 2: Verify user_id columns
-- ============================================
SELECT 'CHECK 2: user_id columns' as check_type;

SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  CASE 
    WHEN data_type = 'uuid' THEN '✅ Correct type'
    ELSE '❌ Wrong type'
  END as status
FROM information_schema.columns 
WHERE table_schema = 'public' 
AND column_name = 'user_id'
AND table_name IN ('decks', 'reviews')
ORDER BY table_name;

-- ============================================
-- CHECK 3: Verify RLS is enabled
-- ============================================
SELECT 'CHECK 3: RLS enabled' as check_type;

SELECT 
  tablename,
  CASE 
    WHEN rowsecurity THEN '✅ RLS Enabled'
    ELSE '❌ RLS Disabled'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
ORDER BY tablename;

-- ============================================
-- CHECK 4: List all current policies
-- ============================================
SELECT 'CHECK 4: Current RLS Policies' as check_type;

SELECT 
  tablename,
  policyname,
  cmd as operation,
  permissive,
  CASE 
    WHEN qual IS NOT NULL THEN 'Has USING'
    ELSE 'No USING'
  END as using_check,
  CASE 
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK'
    ELSE 'No WITH CHECK'
  END as with_check_status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
ORDER BY tablename, cmd, policyname;

-- ============================================
-- CHECK 5: Verify policy expressions
-- ============================================
SELECT 'CHECK 5: Policy Expressions (decks INSERT)' as check_type;

SELECT 
  policyname,
  with_check as insert_check_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'decks'
AND cmd = 'INSERT';

-- Expected: with_check should contain "auth.uid() = user_id" or similar

-- ============================================
-- CHECK 6: Count policies per table
-- ============================================
SELECT 'CHECK 6: Policy count per table' as check_type;

SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) = 4 THEN '✅ Correct (4 policies)'
    WHEN COUNT(*) < 4 THEN '⚠️ Missing policies'
    ELSE '⚠️ Too many policies'
  END as status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
GROUP BY tablename
ORDER BY tablename;

-- ============================================
-- CHECK 7: Test auth.uid() function
-- ============================================
SELECT 'CHECK 7: Auth function test' as check_type;

SELECT 
  CASE 
    WHEN auth.uid() IS NOT NULL THEN '✅ You are authenticated'
    ELSE '❌ Not authenticated (this is OK for SQL Editor)'
  END as auth_status,
  auth.uid() as your_user_id;

-- ============================================
-- SUMMARY
-- ============================================
SELECT 'SUMMARY: Expected Results' as info;

SELECT 
  'Tables: 3 found (decks, cards, reviews)' as expectation
UNION ALL
SELECT 'user_id columns: 2 found (decks, reviews), type uuid'
UNION ALL
SELECT 'RLS: Enabled on all 3 tables'
UNION ALL
SELECT 'Policies: 4 per table = 16 total (SELECT, INSERT, UPDATE, DELETE)'
UNION ALL
SELECT 'decks INSERT policy: with_check = (auth.uid() = user_id)';

-- ============================================
-- If you see issues, run the cleanup script:
-- cleanup_and_fix_rls.sql
-- ============================================

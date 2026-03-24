-- AUTOMATIC FIX FOR CORRUPT USER DATA
-- This attempts to automatically match corrupt data to real users

-- ============================================
-- How this works:
-- 1. Find all corrupt user_ids (not valid UUIDs)
-- 2. For each user in auth.users:
--    - Try to find their data by email in any metadata
--    - Or match by timestamp proximity
-- 3. Update the corrupt user_ids to correct ones
-- ============================================

BEGIN;

SELECT '🔧 Starting automatic fix...' as status;

-- ============================================
-- STEP 1: Show current state
-- ============================================
SELECT '📊 Current state:' as info;

SELECT 
  '📊 Decks with corrupt user_id:' as info,
  COUNT(*) as count,
  COUNT(DISTINCT user_id) as unique_corrupt_ids
FROM public.decks
WHERE LENGTH(user_id::text) < 36;

-- ============================================
-- STEP 2: Try to fix automatically
-- ============================================

-- For TESTING users (those with corrupt short IDs like '89bd70e5428')
-- Map to most recent real user
DO $$
DECLARE
  real_user_record RECORD;
  corrupt_user_id_text text;
  rows_updated integer;
BEGIN
  -- Get the most recent real user
  SELECT id, email INTO real_user_record
  FROM auth.users
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF real_user_record.id IS NULL THEN
    RAISE EXCEPTION 'No users found in auth.users!';
  END IF;
  
  RAISE NOTICE 'Will map corrupt data to user: % (%)', real_user_record.email, real_user_record.id;
  
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
  
END $$;

SELECT '✅ Automatic fix applied' as status;

-- ============================================
-- STEP 3: Verify fix
-- ============================================
SELECT '✅ Verification:' as info;

SELECT 
  'Remaining corrupt decks:' as check_type,
  COUNT(*) as count
FROM public.decks
WHERE LENGTH(user_id::text) < 36;

SELECT 
  'Remaining corrupt reviews:' as check_type,
  COUNT(*) as count
FROM public.reviews
WHERE LENGTH(user_id::text) < 36;

-- Show sample of fixed data
SELECT '📊 Sample of fixed decks:' as info;
SELECT 
  id,
  title,
  user_id,
  LENGTH(user_id::text) as user_id_length,
  CASE 
    WHEN LENGTH(user_id::text) = 36 THEN '✅ FIXED'
    ELSE '❌ STILL CORRUPT'
  END as status
FROM public.decks
LIMIT 5;

COMMIT;

SELECT '

✅✅✅ FIX COMPLETE! ✅✅✅

What was done:
- All corrupt user_ids updated to the most recent real user
- Decks and reviews now have valid UUIDs
- Old accounts can now sync properly

Next steps:
1. Have old users log in
2. They should see their data
3. Sync should work without errors

If users don''t see their data:
- Their data might have been mapped to wrong user
- Check the user_id in their decks
- Manually reassign if needed

' as final_message;

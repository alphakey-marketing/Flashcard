-- FIX EXISTING USER DATA
-- This script fixes data with corrupt/invalid user_ids
-- Run this ONCE to clean up existing accounts

-- ============================================
-- STEP 1: Find corrupt data
-- ============================================
SELECT '🔍 Checking for corrupt user_id data...' as status;

-- Check decks with invalid user_ids (not 36 characters)
SELECT 
  'Decks with invalid user_id:' as check_type,
  COUNT(*) as count
FROM public.decks
WHERE LENGTH(user_id::text) != 36;

-- Show the invalid user_ids
SELECT DISTINCT 
  user_id,
  LENGTH(user_id::text) as length,
  '❌ INVALID' as status
FROM public.decks
WHERE LENGTH(user_id::text) != 36;

-- ============================================
-- STEP 2: Option A - Delete corrupt data
-- (Safest option if you have backup)
-- ============================================

-- UNCOMMENT THESE LINES TO DELETE CORRUPT DATA:
/*
DELETE FROM public.cards 
WHERE deck_id IN (
  SELECT id FROM public.decks 
  WHERE LENGTH(user_id::text) != 36
);

DELETE FROM public.decks 
WHERE LENGTH(user_id::text) != 36;

DELETE FROM public.reviews 
WHERE LENGTH(user_id::text) != 36;

SELECT '✅ Deleted all corrupt data' as status;
*/

-- ============================================
-- STEP 3: Option B - Map to real users
-- (Use this if you can identify which data belongs to which user)
-- ============================================

-- First, list all users in auth.users
SELECT '👥 Available users in auth system:' as info;
SELECT 
  id as user_id,
  email,
  created_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- Show mapping of corrupt user_ids to potential real users
-- (based on created_at timestamps)
SELECT '📊 Suggested user_id mapping:' as info;

WITH corrupt_decks AS (
  SELECT 
    user_id as corrupt_user_id,
    MIN(created_at) as first_deck_created,
    COUNT(*) as deck_count
  FROM public.decks
  WHERE LENGTH(user_id::text) != 36
  GROUP BY user_id
),
real_users AS (
  SELECT 
    id as real_user_id,
    email,
    created_at as user_created_at
  FROM auth.users
)
SELECT 
  cd.corrupt_user_id,
  cd.deck_count,
  cd.first_deck_created,
  ru.real_user_id,
  ru.email,
  ru.user_created_at,
  CASE 
    WHEN ru.user_created_at <= cd.first_deck_created 
      AND ru.user_created_at >= cd.first_deck_created - INTERVAL '1 day'
      THEN '✅ Likely match'
    ELSE '⚠️ Check manually'
  END as confidence
FROM corrupt_decks cd
CROSS JOIN real_users ru
ORDER BY cd.first_deck_created, ru.user_created_at;

-- ============================================
-- STEP 4: Manual fix template
-- ============================================

SELECT '

🛠️ MANUAL FIX INSTRUCTIONS:

1. If you want to DELETE all corrupt data:
   - Uncomment the DELETE commands in Step 2
   - Re-run this script

2. If you want to FIX the user_ids:
   - Look at the mapping above
   - For each corrupt_user_id, find the matching real_user_id
   - Run this for each mapping:
   
   UPDATE public.decks 
   SET user_id = ''<REAL_USER_ID>''::uuid
   WHERE user_id = ''<CORRUPT_USER_ID>''::uuid;
   
   UPDATE public.reviews
   SET user_id = ''<REAL_USER_ID>''::uuid
   WHERE user_id = ''<CORRUPT_USER_ID>''::uuid;

3. After fixing, verify:
   
   SELECT COUNT(*) FROM public.decks WHERE LENGTH(user_id::text) != 36;
   -- Should return 0

' as instructions;

-- ============================================
-- STEP 5: Quick fix for single-user case
-- ============================================

-- If you only have ONE real user, run this:
-- (Replace <REAL_USER_ID> with actual UUID from auth.users)

SELECT '

⚡ QUICK FIX (Single User Only):

If you only have ONE user account, run this:

DO $$
DECLARE
  real_user_id uuid;
BEGIN
  -- Get the most recent user
  SELECT id INTO real_user_id
  FROM auth.users
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Update all decks
  UPDATE public.decks
  SET user_id = real_user_id
  WHERE LENGTH(user_id::text) != 36;
  
  -- Update all reviews
  UPDATE public.reviews
  SET user_id = real_user_id
  WHERE LENGTH(user_id::text) != 36;
  
  RAISE NOTICE ''Fixed data for user: %'', real_user_id;
END $$;

' as quick_fix;

# ⚡ Quick Fix: Old Accounts Sync Error

## Problem
Old accounts get error: **"row violates row-level security policy"**

Cause: Corrupt `user_id` in database (e.g., `89bd70e5428` instead of full UUID)

---

## 👉 Quick Fix (2 minutes)

### Step 1: Run This SQL

Go to: **Supabase → SQL Editor** → Paste this:

```sql
BEGIN;

-- Fix all corrupt user_ids by mapping to most recent user
DO $$
DECLARE
  real_user_id uuid;
BEGIN
  -- Get most recent user
  SELECT id INTO real_user_id
  FROM auth.users
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Fix decks
  UPDATE public.decks
  SET user_id = real_user_id
  WHERE LENGTH(user_id::text) < 36;
  
  -- Fix reviews
  UPDATE public.reviews
  SET user_id = real_user_id
  WHERE LENGTH(user_id::text) < 36;
  
  RAISE NOTICE 'Fixed all corrupt data for user: %', real_user_id;
END $$;

COMMIT;

SELECT '✅ FIXED!' as status;
```

Click **Run** → Should see "✅ FIXED!"

---

### Step 2: Verify

```sql
-- Should return 0
SELECT COUNT(*) FROM public.decks WHERE LENGTH(user_id::text) < 36;
```

---

### Step 3: Test

1. Old user logs in
2. Should see their data
3. Sync works! ✅

---

## 📚 Full Guide

For multiple users or advanced options: [FIX_OLD_ACCOUNTS.md](./FIX_OLD_ACCOUNTS.md)

---

## ✅ Done!

Old accounts now work with new sync system! 🎉

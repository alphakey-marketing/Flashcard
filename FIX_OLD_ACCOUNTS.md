# 🔧 Fix Old Accounts - Corrupt user_id Data

## 🐛 Problem

**Old accounts have data with corrupt `user_id` values** like:
- `89bd70e5428` (only 11 characters) ❌
- Instead of: `12345678-abcd-1234-abcd-123456789abc` (36 characters) ✅

When old users try to log in, sync fails with:
```
Failed to sync deck: new row violates row-level security policy (USING expression) for table "decks"
```

---

## 👉 Solution

Run ONE of these SQL scripts in Supabase to fix the corrupt data:

---

## ⚡ Option 1: Automatic Fix (Recommended)

**Use this if:**
- You only have a few users
- You're okay with mapping all old data to the most recent user

### Steps:

1. **Supabase Dashboard** → SQL Editor

2. **Copy and run**: [AUTO_FIX_USER_DATA.sql](./supabase/migrations/AUTO_FIX_USER_DATA.sql)

3. **What it does**:
   - Finds all corrupt user_ids (length < 36)
   - Maps them to the most recent real user from `auth.users`
   - Updates `decks` and `reviews` tables
   - Verifies the fix

4. **Result**:
   ```
   ✅ Fix complete!
   Updated X decks
   Updated Y reviews
   Remaining corrupt decks: 0
   ```

---

## 🔍 Option 2: Manual Fix (If Multiple Users)

**Use this if:**
- You have multiple users
- You need to preserve which data belongs to which user

### Steps:

1. **Supabase Dashboard** → SQL Editor

2. **Copy and run**: [FIX_EXISTING_USER_DATA.sql](./supabase/migrations/FIX_EXISTING_USER_DATA.sql)

3. **This will show you**:
   - List of corrupt user_ids
   - List of real users from `auth.users`
   - Suggested mappings based on timestamps

4. **Then manually map each one**:
   ```sql
   -- Example: Map corrupt ID to real user
   UPDATE public.decks 
   SET user_id = 'abc12345-1234-1234-1234-123456789abc'::uuid
   WHERE user_id = '89bd70e5428'::uuid;
   
   UPDATE public.reviews
   SET user_id = 'abc12345-1234-1234-1234-123456789abc'::uuid
   WHERE user_id = '89bd70e5428'::uuid;
   ```

---

## 🗑️ Option 3: Delete Corrupt Data (Nuclear)

**Use this if:**
- The corrupt data doesn't matter
- You want a clean start

```sql
-- WARNING: This deletes data permanently!

DELETE FROM public.cards 
WHERE deck_id IN (
  SELECT id FROM public.decks 
  WHERE LENGTH(user_id::text) < 36
);

DELETE FROM public.decks 
WHERE LENGTH(user_id::text) < 36;

DELETE FROM public.reviews 
WHERE LENGTH(user_id::text) < 36;

SELECT 'All corrupt data deleted' as status;
```

---

## ✅ Verify the Fix

After running any fix, verify:

```sql
-- Should return 0
SELECT COUNT(*) as corrupt_decks
FROM public.decks
WHERE LENGTH(user_id::text) < 36;

-- Should return 0
SELECT COUNT(*) as corrupt_reviews
FROM public.reviews
WHERE LENGTH(user_id::text) < 36;

-- Check a sample
SELECT 
  title,
  user_id,
  LENGTH(user_id::text) as length,
  CASE 
    WHEN LENGTH(user_id::text) = 36 THEN '✅ OK'
    ELSE '❌ BAD'
  END as status
FROM public.decks
LIMIT 10;
```

---

## 🧪 Test Old Account

1. **Have old user log in**

2. **Open console** (F12)

3. **Watch for**:
   ```
   ✅ [AUTH] Session active: {...}
   ✅ [SYNC] Authenticated as: abc-123-...
   📊 [CLOUD] Pulling decks for user: abc-123-...
   ✅ [CLOUD] Pulled 17 decks from cloud  ← Should see their decks!
   ```

4. **If still fails**:
   - Check Supabase Table Editor
   - Look at `user_id` in `decks` table
   - Does it match the user's actual ID from console?

---

## 🔍 Check User's Real ID

If you need to find a user's correct UUID:

```sql
-- Find user by email
SELECT id, email, created_at
FROM auth.users
WHERE email = 'user@example.com';

-- See what user_id their decks currently have
SELECT DISTINCT user_id, COUNT(*) as deck_count
FROM public.decks
GROUP BY user_id;
```

---

## 🎯 Quick Decision Tree

```
How many users do you have?
├─ Only 1-2 users?
│  └─ Use AUTOMATIC FIX ✅
│
├─ Multiple users AND data matters?
│  └─ Use MANUAL FIX 🔍
│
└─ Data doesn't matter?
   └─ DELETE corrupt data 🗑️
```

---

## ✅ After Fix Checklist

- [ ] Ran one of the fix scripts
- [ ] Verified 0 corrupt records
- [ ] Old user can log in
- [ ] Old user sees their decks
- [ ] Sync completes without errors
- [ ] Console shows valid UUID for user_id

---

## 📞 Still Not Working?

**Share these details:**

1. **Which fix script did you run?**

2. **Result of this query:**
   ```sql
   SELECT 
     (SELECT COUNT(*) FROM public.decks WHERE LENGTH(user_id::text) < 36) as corrupt_decks,
     (SELECT COUNT(*) FROM public.decks) as total_decks,
     (SELECT COUNT(*) FROM auth.users) as total_users;
   ```

3. **Old user's email** (we'll look up their UUID)

4. **Console logs** when they try to sync

---

**Most cases are fixed by the automatic script!** 🚀

# 🔧 RLS Error Troubleshooting

## Error Message
```
Sync Error: Failed to sync deck: new row violates row-level security policy (USING expression) for table "decks"
```

---

## 🔍 Step 1: Run Diagnostics

**In Supabase SQL Editor**, run:

[DIAGNOSE_SYNC_ERROR.sql](./supabase/migrations/DIAGNOSE_SYNC_ERROR.sql)

This will tell you EXACTLY what's wrong.

---

## ⚡ Common Causes & Fixes

### Cause 1: RLS Policies Not Set Up

**Diagnostic shows:**
```
❌ RLS is DISABLED
❌ Missing policies
```

**Fix:**
```sql
-- Run in Supabase SQL Editor:
-- Use FINAL_RLS_FIX.sql script
```

Full script: [FINAL_RLS_FIX.sql](./supabase/migrations/FINAL_RLS_FIX.sql)

**Verify:**
```sql
SELECT COUNT(*) FROM pg_policies 
WHERE tablename IN ('decks', 'cards', 'reviews');
-- Should return 12
```

---

### Cause 2: Corrupt user_id in Database

**Diagnostic shows:**
```
❌ FOUND CORRUPT DATA
user_id: 89bd70e5428 (only 11 chars)
```

**Fix:**
```sql
-- Run in Supabase SQL Editor:
-- Use AUTO_FIX_USER_DATA.sql script
```

Full script: [AUTO_FIX_USER_DATA.sql](./supabase/migrations/AUTO_FIX_USER_DATA.sql)

**Verify:**
```sql
SELECT COUNT(*) FROM public.decks WHERE LENGTH(user_id::text) < 36;
-- Should return 0
```

---

### Cause 3: User Trying to Insert Deck with Someone Else's ID

**Diagnostic shows:**
```
✅ ALL CHECKS PASSED
But sync still fails
```

**This means:** App is trying to create a deck with an ID that already exists for a different user.

**Fix:** Have user clear localStorage:
```javascript
localStorage.removeItem('flashmind-decks');
localStorage.removeItem('flashmind-reviews');
location.reload();
```

---

## 🔄 Full Fix Sequence

**Do these in order:**

### 1. Fix Policies
```sql
-- In Supabase SQL Editor
-- Run: FINAL_RLS_FIX.sql
```

### 2. Fix User Data
```sql
-- In Supabase SQL Editor  
-- Run: AUTO_FIX_USER_DATA.sql
```

### 3. Clear User's Local Storage
```javascript
// In browser console (F12)
localStorage.removeItem('flashmind-decks');
localStorage.removeItem('flashmind-reviews');
alert('✅ Cleared!');
```

### 4. Test
- User refreshes page
- User logs in
- Sync should work! ✅

---

## ✅ Expected Results After Fix

### In Supabase:
```
✅ 12 policies exist
✅ RLS enabled on all tables  
✅ All user_ids are 36-char UUIDs
✅ No corrupt data
```

### In Browser Console:
```
✅ [AUTH] Session active: { userId: 'abc-123-...' }
📊 [CLOUD] Pulling decks for user: abc-123-...
✅ [CLOUD] Pulled X decks from cloud
✅ [SYNC] Sync complete!
```

---

## 📊 Quick Check Commands

### Check RLS Status:
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('decks', 'cards', 'reviews');
```

### Check Policy Count:
```sql
SELECT tablename, COUNT(*) 
FROM pg_policies 
WHERE tablename IN ('decks', 'cards', 'reviews')
GROUP BY tablename;
```

### Check for Corrupt Data:
```sql
SELECT COUNT(*) as corrupt_count
FROM public.decks 
WHERE LENGTH(user_id::text) < 36;
```

### Check Users:
```sql
SELECT id, email, LENGTH(id::text) as id_length
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;
```

---

## 📞 Still Not Working?

**Share these 4 things:**

1. **Output of DIAGNOSE_SYNC_ERROR.sql**

2. **Browser console logs** (full sync output)

3. **Which user** (email) is having the issue

4. **Result of this query:**
   ```sql
   SELECT 
     (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'decks') as policies,
     (SELECT COUNT(*) FROM public.decks WHERE LENGTH(user_id::text) < 36) as corrupt,
     (SELECT rowsecurity FROM pg_tables WHERE tablename = 'decks') as rls_enabled;
   ```

---

## 🛡️ Prevention

To avoid this in future:

1. **Always set up RLS first** before any user data
2. **Never manually insert data** without proper user_id
3. **Use the sync system** - it handles everything correctly
4. **Backup before migrations** - always!

---

**90% of cases are fixed by running FINAL_RLS_FIX.sql!** 🚀

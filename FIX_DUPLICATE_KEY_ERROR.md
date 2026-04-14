# 🔧 Fix: Duplicate Key Error After user_id Fix

## 🐛 Problem

After running `AUTO_FIX_USER_DATA.sql` to fix corrupt user_ids, old accounts get:
```
failed to sync deck: duplicate key value violates unique constraint "deck_pkey"
```

### Why This Happens:

1. Old user logs in
2. Local storage has decks with IDs like `jlpt-n5-food`
3. Cloud NOW has those same decks (after user_id fix)
4. Sync tries to push, but deck IDs already exist
5. RLS policy blocks the update (because it's checking wrong permissions)

---

## ⚡ Quick Fix (3 Options)

### Option 1: Clear Local Storage (Recommended)

**Best for**: Users who haven't created custom decks recently

```javascript
// In browser console (F12)
localStorage.removeItem('flashmind-decks');
localStorage.removeItem('flashmind-reviews');
location.reload();
```

Then login again. Sync will pull everything from cloud.

---

### Option 2: Delete Duplicate Decks from Cloud

**Best for**: Few users, want to re-upload everything

```sql
-- In Supabase SQL Editor
-- Replace USER_EMAIL with actual email

DELETE FROM public.cards 
WHERE deck_id IN (
  SELECT d.id FROM public.decks d
  JOIN auth.users u ON d.user_id = u.id
  WHERE u.email = 'USER_EMAIL'
);

DELETE FROM public.decks
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'USER_EMAIL'
);

SELECT '✅ User data cleared - will re-sync from local' as status;
```

Then user logs in and data syncs from local.

---

### Option 3: Fix RLS Policies (If upsert still fails)

**Best for**: Persistent errors even after Options 1 & 2

The issue might be RLS policies not allowing upsert properly.

```sql
-- Check current policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'decks';

-- Should have UPDATE policy with:
-- USING (user_id = auth.uid())
-- WITH CHECK (user_id = auth.uid())
```

If missing, re-run: `FINAL_RLS_FIX.sql`

---

## 🔍 Root Cause Analysis

### The Sequence That Causes This:

1. **Before fix**: 
   - Cloud has `deck_id: jlpt-n5-food`, `user_id: 89bd70e5428` ❌
   - Local has `deck_id: jlpt-n5-food`
   - User can't sync (RLS blocks corrupt user_id)

2. **After running AUTO_FIX_USER_DATA.sql**:
   - Cloud now has `deck_id: jlpt-n5-food`, `user_id: abc-123-...` ✅
   - Local still has `deck_id: jlpt-n5-food`
   - User logs in

3. **Sync Logic**:
   - Pulls from cloud: Gets `jlpt-n5-food` ✅
   - Loads from local: Has `jlpt-n5-food`
   - Merge: Sees they match by ID ✅
   - **Should NOT push** ✅

4. **But if it DOES try to push**:
   - `upsert` with `deck_id: jlpt-n5-food`
   - Postgres sees it exists
   - Tries to UPDATE
   - RLS policy checks if `user_id = auth.uid()`
   - **Should work** because we fixed user_id

### So Why The Error?

Two possibilities:

**A. Sync logic is wrong** (trying to push when it shouldn't)
- Fixed in latest commit: [9bc17ba](https://github.com/alphakey-marketing/Flashcard/commit/9bc17ba217004068f4773615cede62b44c2497f8)

**B. Stale local storage** (has old deck IDs that conflict)
- Fix: Clear local storage (Option 1)

---

## ✅ Recommended Fix Workflow

### For Each Old User:

**Step 1**: Have them clear local storage
```javascript
localStorage.removeItem('flashmind-decks');
localStorage.removeItem('flashmind-reviews');
location.reload();
```

**Step 2**: Login again

**Step 3**: Verify in console:
```
✅ [SYNC] Authenticated as: abc-123-...
📊 [CLOUD] Pulled 17 decks from cloud
📱 [LOCAL] Local has: 0 decks  ← Empty after clear
🔀 [SYNC] Merge result: 17 total, 17 new from cloud
📤 [SYNC] Found 0 local decks not in cloud  ← Won't push!
✅ [SYNC] Sync complete!
```

**Step 4**: User sees their decks! ✅

---

## 🛡️ Prevention (For Fresh Installs)

To prevent this for new users:

1. **Always run** `FINAL_RLS_FIX.sql` first
2. **Don't** initialize templates until after first sync
3. **Let cloud** be source of truth for templates

---

## 🧪 Debugging Steps

If user still gets error:

### 1. Check what's in their cloud:
```sql
SELECT 
  d.id,
  d.title,
  d.user_id,
  LENGTH(d.user_id::text) as user_id_length,
  u.email
FROM public.decks d
JOIN auth.users u ON d.user_id = u.id
WHERE u.email = 'USER_EMAIL'
LIMIT 10;
```

Should show:
- Valid 36-char UUID in user_id
- Correct email

### 2. Check console during sync:
```
Look for:
- "📤 [SYNC] Found X local decks not in cloud"
- If X > 0, those will be pushed
- If X = 0, nothing pushed (correct!)
```

### 3. Check RLS policies:
```sql
SELECT * FROM pg_policies WHERE tablename = 'decks';
```

Should have 4 policies:
- `decks_select` FOR SELECT
- `decks_insert` FOR INSERT  
- `decks_update` FOR UPDATE
- `decks_delete` FOR DELETE

All should have `TO authenticated`

---

## 📊 Summary Table

| Symptom | Cause | Fix |
|---------|-------|-----|
| Duplicate key on sync | Stale local storage | Clear localStorage |
| RLS policy error | Policies not updated | Re-run FINAL_RLS_FIX.sql |
| Decks missing after sync | Cloud empty | Delete cloud data, re-sync |
| Wrong user_id in cloud | Not fixed yet | Run AUTO_FIX_USER_DATA.sql |

---

## ✅ Success Criteria

Old user should:
1. Login successfully ✅
2. See all their decks ✅
3. Console shows "Sync complete" ✅
4. No error messages ✅
5. Can study normally ✅

---

**Most cases fixed by clearing localStorage!** 🚀

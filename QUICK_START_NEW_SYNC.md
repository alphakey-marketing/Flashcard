# ⚡ Quick Start - New Sync System

## 4 Steps to Fix Everything

### ① Switch to New Branch

```bash
git checkout rebuild-sync-from-scratch
```

---

### ② Run SQL in Supabase

1. Go to: https://app.supabase.com
2. Open your project → SQL Editor
3. Copy script: [FINAL_RLS_FIX.sql](./supabase/migrations/FINAL_RLS_FIX.sql)
4. Paste and Run
5. ✅ Should see "12 total policies"

---

### ③ Delete Old Data

```sql
-- In Supabase SQL Editor:
DELETE FROM public.cards;
DELETE FROM public.decks;
DELETE FROM public.reviews;
```

---

### ④ Test with Fresh Account

1. **Clear browser**:
   ```javascript
   localStorage.clear();
   sessionStorage.clear();
   location.reload();
   ```

2. **Sign up**: `test-new-sync@example.com`

3. **Watch console** - should see:
   ```
   ✅ [SYNC] Sync complete!
      Total decks: 17
   ```

4. **Check Supabase** Table Editor:
   - 17 decks ✅
   - Valid UUID in `user_id` ✅
   - Today's timestamp ✅

---

## ✅ Done!

Your sync system is now bulletproof!

Full docs: [REBUILD_SYNC_GUIDE.md](./REBUILD_SYNC_GUIDE.md)

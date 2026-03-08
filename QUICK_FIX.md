# ⚡ Quick Fix - Supabase RLS Error

## 👉 Do This Now (5 minutes)

### 1️⃣ Open Supabase
Go to: https://app.supabase.com → Your FlashMind Project

### 2️⃣ Open SQL Editor
Left sidebar → Click **"SQL Editor"** icon `</>`

### 3️⃣ Copy This SQL
Open: https://github.com/alphakey-marketing/Flashcard/blob/flashmind-implementation/supabase/migrations/fix_rls_policies.sql

Click **"Raw"** button → Copy all text (Ctrl+A, Ctrl+C)

### 4️⃣ Paste & Run
- Paste into SQL Editor
- Click **"Run"** button (or Ctrl+Enter)
- Wait for "Success" message ✅

### 5️⃣ Test
- Open your FlashMind app
- Sign out
- Browser console: `localStorage.clear()`
- Sign up with a new account
- Should sync 17 decks without errors! 🎉

---

## 👀 What to Look For

**✅ Success looks like:**
```
🔄 Starting sync for user: abc123...
✅ Pulled 0 decks from cloud
📱 Found 17 local decks
📤 Found 17 local decks not in cloud. Syncing...
✅ Synced deck: JLPT N5 - Food & Drink
✅ Synced deck: JLPT N5 - Numbers
...
Sync complete: 17 succeeded, 0 failed
```

**❌ Error looks like:**
```
❌ Failed to sync deck: new row violates row-level security policy
```

---

## 🆘 Still Broken?

1. Check the full guide: [SUPABASE_FIX_GUIDE.md](./SUPABASE_FIX_GUIDE.md)
2. Check Supabase Dashboard → Logs → Database
3. Check browser console (F12) for errors

---

## 🔧 What Was Fixed

**Code Changes (Already Done):**
- ✓ `src/lib/storage.ts` - Fixed template sync timing
- ✓ `src/App.tsx` - Better error handling
- ✓ SQL migration created

**Supabase Changes (You Need to Do):**
- Run SQL script to fix Row Level Security policies
- Ensures authenticated users can create/read their own data

---

## 📝 Notes

- The code fixes are already pushed to GitHub
- You only need to run the SQL script in Supabase
- This is a one-time fix per Supabase project
- Safe to run multiple times (uses `IF EXISTS`)

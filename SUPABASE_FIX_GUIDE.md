# 🔧 Supabase RLS Policy Fix Guide

## Problem Summary
New users see error: **"Failed to sync deck: new row violates row-level security policy (USING expression)"**

This happens because Supabase's Row Level Security (RLS) policies are blocking database inserts.

---

## ✅ Code Fixes (Already Done)

✓ **Fixed `src/lib/storage.ts`** - Removed premature template sync  
✓ **Enhanced `src/App.tsx`** - Better sync flow and error handling  
✓ **Created SQL migration** - `supabase/migrations/fix_rls_policies.sql`

---

## 📋 Supabase Dashboard Steps

### Step 1: Open Supabase Dashboard

1. Go to https://app.supabase.com
2. Sign in to your account
3. Click on your **FlashMind** project (or whatever you named it)

---

### Step 2: Navigate to SQL Editor

1. In the left sidebar, click **"SQL Editor"** (it has a `</>` icon)
2. Click **"New query"** button (top right)

---

### Step 3: Copy the Fix SQL Script

**Option A: From GitHub (Recommended)**

1. Open this file in your browser:
   ```
   https://github.com/alphakey-marketing/Flashcard/blob/flashmind-implementation/supabase/migrations/fix_rls_policies.sql
   ```

2. Click the **"Raw"** button (top right of the file)

3. Copy ALL the SQL code (Ctrl+A, Ctrl+C)

**Option B: Use the script below**

Copy this entire SQL script:

```sql
-- Fix RLS Policies for FlashMind Sync Error

DROP POLICY IF EXISTS "Users can insert their own decks" ON public.decks;
DROP POLICY IF EXISTS "Users can view their own decks" ON public.decks;
DROP POLICY IF EXISTS "Users can update their own decks" ON public.decks;
DROP POLICY IF EXISTS "Users can delete their own decks" ON public.decks;

DROP POLICY IF EXISTS "Users can insert cards to their decks" ON public.cards;
DROP POLICY IF EXISTS "Users can view cards of their decks" ON public.cards;
DROP POLICY IF EXISTS "Users can update cards of their decks" ON public.cards;
DROP POLICY IF EXISTS "Users can delete cards of their decks" ON public.cards;

DROP POLICY IF EXISTS "Users can insert their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can view their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can delete their own reviews" ON public.reviews;

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own decks"
ON public.decks FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own decks"
ON public.decks FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own decks"
ON public.decks FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own decks"
ON public.decks FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert cards to their decks"
ON public.cards FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE id = cards.deck_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can view cards of their decks"
ON public.cards FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE id = cards.deck_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can update cards of their decks"
ON public.cards FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE id = cards.deck_id AND user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE id = cards.deck_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete cards of their decks"
ON public.cards FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.decks 
    WHERE id = cards.deck_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert their own reviews"
ON public.reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reviews"
ON public.reviews FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
ON public.reviews FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
ON public.reviews FOR DELETE
USING (auth.uid() = user_id);
```

---

### Step 4: Paste and Run the Script

1. **Paste** the SQL code into the SQL Editor

2. Click the **"Run"** button (or press Ctrl+Enter)

3. Wait for the query to complete (should take 1-2 seconds)

4. You should see: **"Success. No rows returned"** ✅

---

### Step 5: Verify the Policies

Run this verification query to confirm everything is set up correctly:

```sql
SELECT 
  tablename,
  policyname,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING clause set'
    ELSE 'No USING clause'
  END as using_check,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK clause set'
    ELSE 'No WITH CHECK clause'
  END as with_check_status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('decks', 'cards', 'reviews')
ORDER BY tablename, policyname;
```

**Expected Result:** You should see 16 policies (4 for each table: SELECT, INSERT, UPDATE, DELETE)

---

### Step 6: Test with a New Account

1. **In your FlashMind app**, sign out

2. **Clear browser data** (to simulate a fresh user):
   - Open browser console (F12)
   - Type: `localStorage.clear()`
   - Press Enter
   - Refresh the page

3. **Sign up with a new test account**

4. **Watch for the sync process**:
   - You should see "Syncing your progress..."
   - It should complete without errors ✅
   - All 17 JLPT template decks should appear

---

## 🔍 Troubleshooting

### Still seeing "RLS policy" errors?

**Check 1: Verify tables exist**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('decks', 'cards', 'reviews');
```
You should see all 3 tables.

**Check 2: Verify user_id column exists**
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'decks' 
AND column_name = 'user_id';
```
Should return: `user_id | uuid`

**Check 3: Test insert manually**
```sql
-- First, get your user ID
SELECT auth.uid();

-- Then try inserting a test deck (replace <YOUR_USER_ID> with the result above)
INSERT INTO public.decks (id, user_id, title, description)
VALUES (
  gen_random_uuid(),
  '<YOUR_USER_ID>',
  'Test Deck',
  'Testing RLS policies'
);

-- If successful, clean up:
DELETE FROM public.decks WHERE title = 'Test Deck';
```

---

### Error: "auth.uid() does not exist"

This means you're not authenticated in the SQL Editor.

**Fix**: The policies will still work in your app! The error only affects testing in SQL Editor.

If you need to test in SQL Editor:
1. Use the "RLS disabled" toggle (top right of Table Editor)
2. Or test through your app instead

---

### Error: "policy already exists"

The script already includes `DROP POLICY IF EXISTS` to handle this.

If you still see this error:
1. Run just the DROP statements first
2. Then run the CREATE statements

---

## 📊 Understanding RLS Policies

### What is RLS?
Row Level Security (RLS) controls which rows users can access in your database.

### Policy Structure

```sql
CREATE POLICY "policy_name"
ON table_name
FOR operation  -- SELECT, INSERT, UPDATE, DELETE
USING (condition)  -- For SELECT, UPDATE, DELETE
WITH CHECK (condition);  -- For INSERT, UPDATE
```

### Our Policy Logic

**For DECKS table:**
- `auth.uid() = user_id` - User can only access their own decks

**For CARDS table:**
- User can access cards IF they own the parent deck
- Uses `EXISTS` subquery to check deck ownership

**For REVIEWS table:**
- `auth.uid() = user_id` - User can only access their own review data

---

## ✅ Success Checklist

- [ ] SQL script ran without errors in Supabase
- [ ] Verification query shows 16 policies
- [ ] Test account can sign up successfully
- [ ] All 17 JLPT decks sync to cloud
- [ ] No "RLS policy" errors appear
- [ ] Console shows "✅ Synced deck: ..." messages

---

## 🆘 Still Need Help?

If you're still experiencing issues:

1. **Check Supabase Logs:**
   - Dashboard → Logs → Database
   - Look for detailed error messages

2. **Check Browser Console:**
   - Press F12
   - Look for error messages in red
   - Copy the full error message

3. **Share these details:**
   - Exact error message
   - Screenshot of Supabase policies page
   - Browser console logs

---

## 📚 Resources

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Understanding PostgreSQL Policies](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- [FlashMind GitHub Repo](https://github.com/alphakey-marketing/Flashcard)

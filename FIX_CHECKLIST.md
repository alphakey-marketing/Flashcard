# ☑️ RLS Error Fix Checklist

## Do These 4 Steps (In Order)

### ☐ Step 1: Run SQL Script in Supabase

1. Go to: https://app.supabase.com
2. Open your FlashMind project
3. Click **SQL Editor** (left sidebar)
4. Copy script from: [EMERGENCY_FIX_rls.sql](./supabase/migrations/EMERGENCY_FIX_rls.sql)
5. Paste and click **Run**
6. ✅ You should see: "12 policies created"

---

### ☐ Step 2: Clear Browser Data

1. Open your FlashMind app
2. Press **F12** (opens Developer Tools)
3. Click **Console** tab
4. Type this and press Enter:
   ```javascript
   localStorage.clear(); sessionStorage.clear(); location.reload();
   ```
5. ✅ Page refreshes

---

### ☐ Step 3: Sign Up with NEW Email

1. Use a **completely new** email: `test123@example.com`
2. Create password
3. Sign up
4. ✅ Syncing starts

---

### ☐ Step 4: Check Console for Success

Keep Developer Tools open (F12 → Console)

Look for:
```
✅ Auth verified - User: ...
✅ Deck "JLPT N5 - Food & Drink" synced successfully
✅ Deck "JLPT N5 - Numbers" synced successfully
...
Sync complete: 17 succeeded, 0 failed
```

---

## ✅ Success = All 17 Decks Appear in App!

## ❌ Still Broken? 

Read: [ULTIMATE_FIX_GUIDE.md](./ULTIMATE_FIX_GUIDE.md)

---

## Quick Links

- 🔥 [ULTIMATE_FIX_GUIDE.md](./ULTIMATE_FIX_GUIDE.md) - Detailed troubleshooting
- 💊 [EMERGENCY_FIX_rls.sql](./supabase/migrations/EMERGENCY_FIX_rls.sql) - SQL script
- 🔍 [diagnostic_check.sql](./supabase/migrations/diagnostic_check.sql) - Check database

---

## What Changed?

**Code (automatic):**
- ✅ Better auth handling in supabaseClient.ts
- ✅ Completely rewritten syncService.ts with detailed logging
- ✅ Fixed session persistence

**Database (YOU need to do):**
- ☐ Run SQL script to fix RLS policies

That's it! The code is fixed, you just need to fix the database policies.

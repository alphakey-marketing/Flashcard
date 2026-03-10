# ⚡ Quick Fix: Duplicate Key Error

## Error Message
```
failed to sync deck: duplicate key value violates unique constraint "deck_pkey"
```

---

## 👉 Fix (30 seconds)

### Have the user do this:

1. **Open browser console** (Press F12)

2. **Paste and run**:
```javascript
localStorage.removeItem('flashmind-decks');
localStorage.removeItem('flashmind-reviews');
alert('✅ Cleared! Now reload the page.');
```

3. **Refresh page** (F5)

4. **Login** with their email again

5. **Done!** Sync will pull their data from cloud ✅

---

## Why This Works

The error happens because:
- Cloud has their decks (after you fixed user_id)
- Local storage ALSO has the same decks
- Sync gets confused and tries to upload duplicates

Clearing local storage forces a fresh download from cloud.

---

## 📚 Full Guide

For other options: [FIX_DUPLICATE_KEY_ERROR.md](./FIX_DUPLICATE_KEY_ERROR.md)

---

## ✅ Expected Result

User sees:
```
📊 [CLOUD] Pulled 17 decks from cloud
📱 [LOCAL] Local has: 0 decks
✅ [SYNC] Sync complete!
```

All their decks appear! 🎉

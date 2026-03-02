# Setup Instructions for Replit

## Configure Supabase Environment Variables

Since you're using Replit, follow these steps:

### Step 1: Add Secrets in Replit

1. In your Replit project, click on the **🔒 Secrets** tab (lock icon) in the left sidebar
2. Add the following two secrets:

   **Secret 1:**
   - Key: `VITE_SUPABASE_URL`
   - Value: `https://btvvuenqfuqnietyafpd.supabase.co`

   **Secret 2:**
   - Key: `VITE_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0dnZ1ZW5xZnVxbmlldHlhZnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTA5NjAsImV4cCI6MjA4Nzk2Njk2MH0.KLNMsTDAlHU2r5IItR_MrHXYV-HgzpDMZBdQsHfRdfA`

### Step 2: Restart Your Application

After adding the secrets:
1. Stop your current dev server (if running)
2. Click the **Run** button to restart

### Step 3: Verify Setup

The error "supabaseUrl is required" should now be gone!

## Using the Supabase Client

In your React components, import and use the Supabase client:

```typescript
import { supabase } from './supabaseClient'

// Example: Fetch data
const { data, error } = await supabase
  .from('your_table')
  .select('*')
```

## Alternative: Local .env File

If you prefer using a `.env` file instead of Replit Secrets:

1. Create a `.env` file in the root directory
2. Add the environment variables:
   ```
   VITE_SUPABASE_URL=https://btvvuenqfuqnietyafpd.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0dnZ1ZW5xZnVxbmlldHlhZnBkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTA5NjAsImV4cCI6MjA4Nzk2Njk2MH0.KLNMsTDAlHU2r5IItR_MrHXYV-HgzpDMZBdQsHfRdfA
   ```
3. Restart your dev server

**Note:** The `.env` file is already in `.gitignore` so it won't be committed to Git.

---
name: verifier-flashmind-web
description: Evidence-capture protocol for verifying FlashMind's web UI (React/Vite + Express) end-to-end in a real browser. Use this before claiming any UI change (Reader, Home, Stats, Swipe, etc.) works — it covers launching both dev servers, getting past the Supabase login gate, and known Playwright gotchas specific to this app.
---

# FlashMind web verifier

This app is a Vite/React SPA (`src/`) backed by an Express API (`server.js`).
Almost everything lives behind a Supabase auth gate (`src/App.tsx`), so
verification means driving a real logged-in browser session, not just
curling the API.

## 1. Launch

Two processes, two ports. Vite proxies `/api/*` to the backend (see
`vite.config.js`) — both must be running or you'll get HTML error pages
back from API calls instead of JSON (this exact failure mode caused a
real user-facing bug once: a stale/missing backend route surfaced to the
user as `Unexpected token '<' ... is not valid JSON`).

```bash
node server.js          # backend, port 3001 — run in background
npm run dev              # vite, port 5173 — run in background
```

Sanity-check both before driving the UI:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/tokenize -X POST -H "Content-Type: application/json" -d '{}'
```

If you edited `server.js` and it was already running from a previous
session, **restart it** — Node doesn't hot-reload, so a stale process will
silently keep serving old routes (404 on anything you just added) or run
against outdated data flows. `netstat -ano | grep :3001` to find the PID,
`taskkill //PID <pid> //F` to kill it, then relaunch.

## 2. Auth gate

There is no guest/dev bypass — `App.tsx` renders `<Auth />` until a
Supabase session exists. You need a real test account's email/password.
**Never hardcode credentials in this repo** (this file is git-tracked) —
ask the user for a test login each session, or read it from an
untracked/gitignored local env file if one already exists.

After submitting login, a full cloud sync runs (`SyncManager.performSync`)
behind a "Syncing Your Data" full-screen spinner — wait for it to detach,
not a fixed timeout:

```js
await page.click('button:has-text("Log In")');
await page.waitForSelector('text=/Syncing Your Data/i', { timeout: 5000 }).catch(() => {});
await page.waitForSelector('text=/Syncing Your Data/i', { state: 'detached', timeout: 60000 }).catch(() => {});
```

## 3. Playwright setup (no project devDependency)

`playwright` is not in `package.json`. Don't add it there just to verify —
install it in the scratchpad instead so verification never touches the
project's dependency tree:

```bash
mkdir -p <scratchpad>/pw && cd <scratchpad>/pw
npm init -y && npm install playwright@1.61.1
npx playwright install chromium
```

Headless Chromium in this environment *does* carry real speech-synthesis
voices (`speechSynthesis.getVoices()` returned 10, including Japanese) —
so TTS features can be verified for real (`speechSynthesis.speaking`/
`.pending` are reliable signals), not just assumed untestable.

## 4. Known selector gotchas

- **"+ New" is ambiguous** on ReaderHub: the header button and the
  empty-state "+ New Passage" button both match `button:has-text("+ New")`.
  Use `page.getByRole('button', { name: '+ New', exact: true })`.
- **Delete/confirm dialogs are native `window.confirm()`**, not a custom
  modal — register `page.on('dialog', d => d.accept())` before clicking
  any delete button, or the click hangs.
- **URL import is slow** (server-side fetch + Readability/JSDOM parse of
  a real page, often 3–10s) — don't wait a fixed timeout, wait for the
  "Fetching…" button state to detach: `page.waitForSelector('button:has-text("Fetching")', { state: 'detached', timeout: 20000 })`.
- **Editing a passage's raw text re-tokenizes** via `/api/tokenize` (see
  `passageStore.ts:updatePassage`) — a save can take a beat longer than a
  title-only edit.

## 5. Cleanup

Any passage/deck/etc. created against a real test account during
verification should be deleted afterward (loop over
`button[title="Delete passage"]` accepting the confirm dialog, or the
equivalent for whatever entity you created) so repeated verification runs
don't pollute the account with test data.

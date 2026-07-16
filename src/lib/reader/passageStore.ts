/**
 * Passage management (FR-05 MVP: paste raw text -> tokenised lesson).
 * Local-first cache over the `passages` table, mirroring storage.ts's pattern.
 */

import { supabase } from '../supabaseClient';
import { SupabaseAuth } from '../sync/supabaseAuth';
import { storageCache } from '../storageCache';
import { countContentWords } from './textUtils';
import type { CaptionCue, Passage, Token } from './types';

const STORAGE_KEY = 'flashmind-passages';
const CACHE_TTL = 5000;

let hydratePromise: Promise<void> | null = null;

function loadLocal(): Passage[] {
  return storageCache.get<Passage[]>(STORAGE_KEY, CACHE_TTL) || [];
}

function saveLocal(passages: Passage[]): void {
  storageCache.set(STORAGE_KEY, passages);
}

function rowFromCloud(row: any): Passage {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type,
    sourceUrl: row.source_url || undefined,
    videoId: row.video_id || undefined,
    captionCues: row.caption_cues || undefined,
    collectionId: row.collection_id || undefined,
    rawText: row.raw_text,
    tokens: row.tokens || [],
    wordCount: row.word_count,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at || row.created_at).getTime(),
  };
}

function rowToCloud(p: Passage, userId: string) {
  return {
    id: p.id,
    user_id: userId,
    collection_id: p.collectionId || null,
    title: p.title,
    source_type: p.sourceType,
    source_url: p.sourceUrl || null,
    video_id: p.videoId || null,
    caption_cues: p.captionCues || null,
    raw_text: p.rawText,
    tokens: p.tokens,
    word_count: p.wordCount,
  };
}

function hydrateFromCloud(): Promise<void> {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const isAuth = await SupabaseAuth.isAuthenticated();
    if (!isAuth) return;

    const userId = await SupabaseAuth.getUserId();
    const { data, error } = await supabase
      .from('passages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [PASSAGES] Failed to pull passages:', error.message);
      return;
    }

    const cloudRows = (data || []).map(rowFromCloud);
    const merged = new Map<string, Passage>();
    for (const p of loadLocal()) merged.set(p.id, p);
    for (const p of cloudRows) merged.set(p.id, p);

    saveLocal(Array.from(merged.values()));
  })();

  return hydratePromise;
}

/** Call once when the Reader hub mounts, before reading the passage list. */
export async function ensurePassagesHydrated(): Promise<void> {
  await hydrateFromCloud();
}

export function getAllPassages(): Passage[] {
  return loadLocal().sort((a, b) => b.createdAt - a.createdAt);
}

export function getPassage(id: string): Passage | undefined {
  return loadLocal().find(p => p.id === id);
}

function pushToCloud(passage: Passage): void {
  SupabaseAuth.getUserId()
    .then(userId => {
      supabase
        .from('passages')
        .upsert(rowToCloud(passage, userId), { onConflict: 'id' })
        .then(({ error }: { error: { message: string } | null }) => {
          if (error) console.error('❌ [PASSAGES] Background sync failed:', error.message);
        });
    })
    .catch(() => { /* not authenticated — nothing to push, local write already succeeded */ });
}

/**
 * Tokenises raw text via /api/tokenize and saves the resulting passage locally + in the background to Supabase.
 *
 * Video-only YouTube imports (no captions found) pass rawText: '' and skip tokenization entirely — videoId
 * alone is enough for playback, and there's no text to tokenize.
 *
 * Captioned video imports pass `precomputedTokens` (built by tokenizing each caption cue individually via
 * /api/tokenize-cues, so captionCues[].tokenStart/tokenEnd line up exactly). Re-tokenizing the joined rawText
 * here via /api/tokenize would silently desync those ranges — kuromoji can segment differently with full-text
 * context than it does per-cue — so precomputed tokens always take priority over calling /api/tokenize.
 */
export async function createPassage(
  title: string,
  rawText: string,
  sourceType: 'text' | 'url' | 'youtube' = 'text',
  sourceUrl?: string,
  collectionId?: string,
  videoId?: string,
  captionCues?: CaptionCue[],
  precomputedTokens?: Token[]
): Promise<Passage> {
  let tokens: Token[] = precomputedTokens ?? [];

  if (!precomputedTokens && rawText.trim()) {
    const response = await fetch('/api/tokenize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawText }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({} as Record<string, string>));
      throw new Error(err.error ?? `Tokenize failed: HTTP ${response.status}`);
    }

    ({ tokens } = await response.json() as { tokens: Token[] });
  }

  const now = Date.now();

  const passage: Passage = {
    id: crypto.randomUUID(),
    title: title.trim() || 'Untitled passage',
    sourceType,
    sourceUrl,
    videoId,
    captionCues,
    collectionId,
    rawText,
    tokens,
    wordCount: countContentWords(tokens),
    createdAt: now,
    updatedAt: now,
  };

  // Append via spread, not push() — loadLocal() can return the same cached array
  // reference across calls, and mutating it in place means a later setState with
  // that "same" reference gets silently skipped by React's Object.is bailout.
  saveLocal([...loadLocal(), passage]);
  pushToCloud(passage);

  return passage;
}

/** Assign (or clear, via undefined) a passage's collection. Updates local state immediately. */
export function movePassageToCollection(passageId: string, collectionId: string | undefined): void {
  const passages = loadLocal();
  const index = passages.findIndex(p => p.id === passageId);
  if (index < 0) return;

  const updated: Passage = { ...passages[index], collectionId, updatedAt: Date.now() };
  saveLocal(passages.map((p, i) => (i === index ? updated : p)));
  pushToCloud(updated);
}

/**
 * Edit a passage's title and/or text. Re-tokenizes via /api/tokenize only when
 * the raw text actually changed, so a title-only edit is a cheap local write.
 */
export async function updatePassage(id: string, title: string, rawText: string): Promise<Passage> {
  const passages = loadLocal();
  const index = passages.findIndex(p => p.id === id);
  if (index < 0) throw new Error('Passage not found');

  const existing = passages[index];
  let tokens = existing.tokens;
  // Editing the transcript text of a captioned video passage invalidates
  // captionCues' tokenStart/tokenEnd ranges (they were computed against the
  // original per-cue tokenization) — drop them rather than leave a stale,
  // now-wrong video sync in place. The video keeps playing; it just loses
  // caption-synced looping until re-imported.
  let captionCues = existing.captionCues;

  if (rawText !== existing.rawText) {
    const response = await fetch('/api/tokenize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawText }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({} as Record<string, string>));
      throw new Error(err.error ?? `Tokenize failed: HTTP ${response.status}`);
    }

    ({ tokens } = await response.json() as { tokens: Token[] });
    captionCues = undefined;
  }

  const updated: Passage = {
    ...existing,
    title: title.trim() || 'Untitled passage',
    rawText,
    tokens,
    captionCues,
    wordCount: countContentWords(tokens),
    updatedAt: Date.now(),
  };

  saveLocal(passages.map((p, i) => (i === index ? updated : p)));
  pushToCloud(updated);

  return updated;
}

/** Unassign a deleted collection from every passage that referenced it. */
export function clearCollectionFromPassages(collectionId: string): void {
  const passages = loadLocal();
  let changed = false;

  const updated = passages.map(p => {
    if (p.collectionId !== collectionId) return p;
    changed = true;
    const next: Passage = { ...p, collectionId: undefined, updatedAt: Date.now() };
    pushToCloud(next);
    return next;
  });

  if (changed) saveLocal(updated);
}

/** Delete a passage locally and (best-effort) in the cloud. */
export async function deletePassage(id: string): Promise<void> {
  try {
    const isAuth = await SupabaseAuth.isAuthenticated();
    if (isAuth) {
      const userId = await SupabaseAuth.getUserId();
      const { error } = await supabase.from('passages').delete().eq('id', id).eq('user_id', userId);
      if (error) console.error('❌ [PASSAGES] Cloud delete failed:', error.message);
    }
  } catch (err) {
    console.error('❌ [PASSAGES] Cloud delete failed:', err);
  }

  saveLocal(loadLocal().filter(p => p.id !== id));
}

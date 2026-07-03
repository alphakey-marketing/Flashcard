/**
 * Passage collection management (UR-06).
 * Local-first cache over the `passage_collections` table, mirroring passageStore.ts's pattern.
 */

import { supabase } from '../supabaseClient';
import { SupabaseAuth } from '../sync/supabaseAuth';
import { storageCache } from '../storageCache';
import { clearCollectionFromPassages } from './passageStore';
import type { Collection } from './types';

const STORAGE_KEY = 'flashmind-passage-collections';
const CACHE_TTL = 5000;

let hydratePromise: Promise<void> | null = null;

function loadLocal(): Collection[] {
  return storageCache.get<Collection[]>(STORAGE_KEY, CACHE_TTL) || [];
}

function saveLocal(collections: Collection[]): void {
  storageCache.set(STORAGE_KEY, collections);
}

function rowFromCloud(row: any): Collection {
  return {
    id: row.id,
    name: row.name,
    description: row.description || undefined,
    createdAt: new Date(row.created_at).getTime(),
  };
}

function rowToCloud(c: Collection, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    description: c.description || null,
  };
}

function hydrateFromCloud(): Promise<void> {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const isAuth = await SupabaseAuth.isAuthenticated();
    if (!isAuth) return;

    const userId = await SupabaseAuth.getUserId();
    const { data, error } = await supabase
      .from('passage_collections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ [COLLECTIONS] Failed to pull collections:', error.message);
      return;
    }

    const cloudRows = (data || []).map(rowFromCloud);
    const merged = new Map<string, Collection>();
    for (const c of loadLocal()) merged.set(c.id, c);
    for (const c of cloudRows) merged.set(c.id, c);

    saveLocal(Array.from(merged.values()));
  })();

  return hydratePromise;
}

/** Call once when the Reader hub mounts, before reading the collection list. */
export async function ensureCollectionsHydrated(): Promise<void> {
  await hydrateFromCloud();
}

export function getAllCollections(): Collection[] {
  return loadLocal().sort((a, b) => a.createdAt - b.createdAt);
}

function pushToCloud(collection: Collection): void {
  SupabaseAuth.getUserId()
    .then(userId => {
      supabase
        .from('passage_collections')
        .upsert(rowToCloud(collection, userId), { onConflict: 'id' })
        .then(({ error }: { error: { message: string } | null }) => {
          if (error) console.error('❌ [COLLECTIONS] Background sync failed:', error.message);
        });
    })
    .catch(() => { /* not authenticated — nothing to push, local write already succeeded */ });
}

export function createCollection(name: string, description?: string): Collection {
  const collection: Collection = {
    id: crypto.randomUUID(),
    name: name.trim() || 'Untitled collection',
    description: description?.trim() || undefined,
    createdAt: Date.now(),
  };

  // Append via spread, not push() — loadLocal() can return the same cached array
  // reference across calls, and mutating it in place means a later setState with
  // that "same" reference gets silently skipped by React's Object.is bailout.
  saveLocal([...loadLocal(), collection]);
  pushToCloud(collection);

  return collection;
}

/** Rename a collection in place. */
export function renameCollection(id: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;

  const collections = loadLocal();
  const index = collections.findIndex(c => c.id === id);
  if (index < 0) return;

  const updated: Collection = { ...collections[index], name: trimmed };
  saveLocal(collections.map((c, i) => (i === index ? updated : c)));
  pushToCloud(updated);
}

/** Delete a collection and unassign it from any passages that reference it. */
export async function deleteCollection(id: string): Promise<void> {
  try {
    const isAuth = await SupabaseAuth.isAuthenticated();
    if (isAuth) {
      const userId = await SupabaseAuth.getUserId();
      const { error } = await supabase.from('passage_collections').delete().eq('id', id).eq('user_id', userId);
      if (error) console.error('❌ [COLLECTIONS] Cloud delete failed:', error.message);
    }
  } catch (err) {
    console.error('❌ [COLLECTIONS] Cloud delete failed:', err);
  }

  saveLocal(loadLocal().filter(c => c.id !== id));
  clearCollectionFromPassages(id);
}

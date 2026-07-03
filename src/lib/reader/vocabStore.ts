/**
 * Vocab state management (FR-02).
 * Local-first cache over the `vocab_status` table, mirroring the
 * optimistic-write-then-background-push pattern used by storage.ts / spacedRepetition.ts.
 *
 * These 6 states drive Reader color-coding AND double as the membership rule
 * for the auto-managed "Reader Vocabulary" flashcard deck (readerDeckSync.ts):
 * a word has a card in that deck exactly while its status is 1-4 ("Learning").
 * Reviewing that deck (via Swipe, LearnMode, or VocabReview — they all funnel
 * through spacedRepetition.ts's saveCardReview) promotes/demotes the status
 * here in turn; see applyReviewRatingToStatus below.
 */

import { supabase } from '../supabaseClient';
import { SupabaseAuth } from '../sync/supabaseAuth';
import { storageCache } from '../storageCache';
import { syncReaderDeckCard } from './readerDeckSync';
import type { Token, VocabStatus, VocabStatusValue } from './types';

const STORAGE_KEY = 'flashmind-vocab-status';
const CACHE_TTL = 5000;

let hydratePromise: Promise<void> | null = null;

function loadLocal(): VocabStatus[] {
  return storageCache.get<VocabStatus[]>(STORAGE_KEY, CACHE_TTL) || [];
}

function saveLocal(rows: VocabStatus[]): void {
  storageCache.set(STORAGE_KEY, rows);
}

function rowFromCloud(row: any): VocabStatus {
  return {
    id: row.id,
    dictionaryForm: row.dictionary_form,
    surface: row.surface,
    reading: row.reading || '',
    status: row.status,
    note: row.note || undefined,
    timesSeen: row.times_seen,
    sourcePassageId: row.source_passage_id || undefined,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function rowToCloud(v: VocabStatus, userId: string) {
  return {
    user_id: userId,
    dictionary_form: v.dictionaryForm,
    surface: v.surface,
    reading: v.reading || null,
    status: v.status,
    note: v.note || null,
    source_passage_id: v.sourcePassageId || null,
    times_seen: v.timesSeen,
  };
}

/** Pull all vocab_status rows for the current user once per session, merging into local cache. */
function hydrateFromCloud(): Promise<void> {
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    const isAuth = await SupabaseAuth.isAuthenticated();
    if (!isAuth) return;

    const userId = await SupabaseAuth.getUserId();
    const { data, error } = await supabase
      .from('vocab_status')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [VOCAB] Failed to pull vocab_status:', error.message);
      return;
    }

    const cloudRows = (data || []).map(rowFromCloud);
    const merged = new Map<string, VocabStatus>();
    for (const row of loadLocal()) merged.set(row.dictionaryForm, row);
    for (const row of cloudRows) merged.set(row.dictionaryForm, row);

    saveLocal(Array.from(merged.values()));
  })();

  return hydratePromise;
}

/** Call once when the Reader mounts, before reading vocab state. */
export async function ensureVocabHydrated(): Promise<void> {
  await hydrateFromCloud();
}

export function getVocabMap(): Map<string, VocabStatus> {
  return new Map(loadLocal().map(r => [r.dictionaryForm, r]));
}

export function getVocabStatus(dictionaryForm: string): VocabStatus | undefined {
  return getVocabMap().get(dictionaryForm);
}

function pushToCloud(rows: VocabStatus[]): void {
  SupabaseAuth.getUserId()
    .then(userId => {
      supabase
        .from('vocab_status')
        .upsert(rows.map(r => rowToCloud(r, userId)), { onConflict: 'user_id,dictionary_form' })
        .then(({ error }: { error: { message: string } | null }) => {
          if (error) console.error('❌ [VOCAB] Background sync failed:', error.message);
        });
    })
    .catch(() => { /* not authenticated — nothing to push, local write already succeeded */ });
}

/** Set a word's status (from the reader popup's status buttons). Updates local state immediately. */
export function setVocabStatus(
  word: { dictionaryForm: string; surface: string; reading: string },
  status: VocabStatusValue,
  opts?: { note?: string; sourcePassageId?: string }
): VocabStatus {
  const rows = loadLocal();
  const index = rows.findIndex(r => r.dictionaryForm === word.dictionaryForm);
  const now = Date.now();

  const updated: VocabStatus = index >= 0
    ? {
        ...rows[index],
        status,
        updatedAt: now,
        ...(opts?.note !== undefined ? { note: opts.note } : {}),
        ...(opts?.sourcePassageId ? { sourcePassageId: opts.sourcePassageId } : {}),
      }
    : {
        dictionaryForm: word.dictionaryForm,
        surface: word.surface,
        reading: word.reading,
        status,
        note: opts?.note,
        timesSeen: 1,
        sourcePassageId: opts?.sourcePassageId,
        updatedAt: now,
      };

  if (index >= 0) rows[index] = updated;
  else rows.push(updated);

  saveLocal(rows);
  pushToCloud([updated]);
  syncReaderDeckCard(updated);
  return updated;
}

/**
 * Applies a Vocab Review rating to a word's Learning-stage status. Reacts only
 * to which button was pressed, not to the SRS engine's internal scheduling
 * numbers (ease factor, interval, etc.) — keeps the two systems loosely
 * coupled. "again" drops a stage (floored at Learning 1 — never exits the
 * review pool back to Unknown). "know_it" raises a stage but caps at
 * Learning 4 — a shaky "not sure" alone can't graduate a word. "mastered"
 * raises a stage and, if the word was already at Learning 4, this is what
 * pushes it to Known.
 * No-ops for words outside the 1-4 range (Known/Ignored/Unknown words are
 * never pulled into Vocab Review in the first place — see getReviewEligibleVocab).
 */
export function applyReviewRatingToStatus(
  dictionaryForm: string,
  rating: 'again' | 'know_it' | 'mastered'
): { previous: VocabStatusValue; next: VocabStatusValue } | undefined {
  const current = getVocabStatus(dictionaryForm);
  if (!current) return undefined;

  const previous = current.status;
  if (previous < 1 || previous > 4) return undefined;

  let next: VocabStatusValue;
  if (rating === 'again') {
    next = Math.max(1, previous - 1) as VocabStatusValue;
  } else if (rating === 'know_it') {
    next = Math.min(4, previous + 1) as VocabStatusValue;
  } else {
    next = (previous === 4 ? 5 : previous + 1) as VocabStatusValue;
  }

  if (next !== previous) {
    setVocabStatus(
      { dictionaryForm: current.dictionaryForm, surface: current.surface, reading: current.reading },
      next
    );
  }

  return { previous, next };
}

/** Save a mnemonic/note without touching the word's current status. */
export function updateVocabNote(dictionaryForm: string, note: string): VocabStatus | undefined {
  const rows = loadLocal();
  const index = rows.findIndex(r => r.dictionaryForm === dictionaryForm);
  if (index < 0) return undefined;

  const updated: VocabStatus = { ...rows[index], note, updatedAt: Date.now() };
  rows[index] = updated;
  saveLocal(rows);
  pushToCloud([updated]);
  return updated;
}

/**
 * Register that these content-word tokens were encountered in a passage:
 * increments times_seen for tracked words, creates new "unknown" rows for
 * first-time words. Call once per passage view. Batches into one cloud upsert.
 */
export function recordWordsSeen(tokens: Token[], sourcePassageId: string): void {
  const byWord = getVocabMap();
  const now = Date.now();
  const touched: VocabStatus[] = [];
  const seenInThisCall = new Set<string>();

  for (const token of tokens) {
    if (!token.isWord || seenInThisCall.has(token.dictionaryForm)) continue;
    seenInThisCall.add(token.dictionaryForm);

    const existing = byWord.get(token.dictionaryForm);
    const updated: VocabStatus = existing
      ? { ...existing, timesSeen: existing.timesSeen + 1, updatedAt: now }
      : {
          dictionaryForm: token.dictionaryForm,
          surface: token.surface,
          reading: token.reading,
          status: 0,
          timesSeen: 1,
          sourcePassageId,
          updatedAt: now,
        };
    byWord.set(token.dictionaryForm, updated);
    touched.push(updated);
  }

  if (touched.length === 0) return;
  saveLocal(Array.from(byWord.values()));
  pushToCloud(touched);
}

const STATUS_COLORS: Record<VocabStatusValue, { background: string; color: string }> = {
  0: { background: '#bfdbfe', color: '#1e3a8a' },      // unknown — blue, "new/clickable"
  1: { background: '#fca5a5', color: '#7f1d1d' },      // learning-1
  2: { background: '#fdba74', color: '#7c2d12' },      // learning-2
  3: { background: '#fde047', color: '#713f12' },      // learning-3
  4: { background: '#fef9c3', color: '#713f12' },      // learning-4 (nearly known)
  5: { background: 'transparent', color: 'inherit' },  // known — blends in, no highlight
  99: { background: 'transparent', color: '#cbd5e1' }, // ignored — dimmed
};

export function getStatusColor(status: VocabStatusValue): { background: string; color: string } {
  return STATUS_COLORS[status];
}

export const STATUS_LABELS: Record<VocabStatusValue, string> = {
  0: 'Unknown',
  1: 'Learning 1',
  2: 'Learning 2',
  3: 'Learning 3',
  4: 'Learning 4',
  5: 'Known',
  99: 'Ignored',
};

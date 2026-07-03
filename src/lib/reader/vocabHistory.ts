/**
 * Daily vocab-status snapshot history (FR-07).
 * Local-only (no cloud sync, no new DB table) — records one row per calendar
 * day with counts by status bucket, so Stats can chart "known words over time".
 * Takes the vocab map as a parameter (rather than importing vocabStore) to
 * avoid a circular import between vocabStore.ts and this module.
 */

import { storageCache } from '../storageCache';
import type { VocabStatus } from './types';

export interface DailyVocabSnapshot {
  date: string; // YYYY-MM-DD
  unknown: number;
  learning: number; // statuses 1-4
  known: number;    // status 5
  ignored: number;  // status 99
  total: number;
}

const STORAGE_KEY = 'flashmind-vocab-history';
const MAX_ENTRIES = 90;

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

function loadHistory(): DailyVocabSnapshot[] {
  return storageCache.get<DailyVocabSnapshot[]>(STORAGE_KEY) || [];
}

function saveHistory(history: DailyVocabSnapshot[]): void {
  storageCache.set(STORAGE_KEY, history);
}

function summarize(vocabMap: Map<string, VocabStatus>): Omit<DailyVocabSnapshot, 'date'> {
  let unknown = 0, learning = 0, known = 0, ignored = 0;
  for (const v of vocabMap.values()) {
    if (v.status === 0) unknown++;
    else if (v.status === 5) known++;
    else if (v.status === 99) ignored++;
    else learning++;
  }
  return { unknown, learning, known, ignored, total: vocabMap.size };
}

/** Call once per Reader-related page mount. No-ops if today's snapshot already exists. */
export function recordDailySnapshotIfNeeded(vocabMap: Map<string, VocabStatus>): void {
  if (vocabMap.size === 0) return;

  const history = loadHistory();
  const today = getTodayDate();

  if (history.length > 0 && history[history.length - 1].date === today) {
    // Already recorded today — refresh it in place so late-day changes still show.
    history[history.length - 1] = { date: today, ...summarize(vocabMap) };
  } else {
    history.push({ date: today, ...summarize(vocabMap) });
  }

  if (history.length > MAX_ENTRIES) history.splice(0, history.length - MAX_ENTRIES);
  saveHistory(history);
}

export function getVocabHistory(limit: number = 30): DailyVocabSnapshot[] {
  const history = loadHistory();
  return history.slice(-limit);
}

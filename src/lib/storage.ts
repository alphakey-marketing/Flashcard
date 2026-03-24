/**
 * Storage Module
 * Handles flashcard sets management with local and cloud sync
 */

import { jlptTemplates } from '../data/jlpt-templates';
import { SyncManager } from './sync/syncManager';
import { CloudSync } from './sync/cloudSync';
import { LocalStorageSync } from './sync/localStorageSync';
import { SupabaseAuth } from './sync/supabaseAuth';

export interface Card {
  id: string;
  front: string;
  back: string;
  example?: string;
}

export type Flashcard = Card;

export interface FlashcardSet {
  id: string;
  title: string;
  description?: string;
  cards: Card[];
  tags?: string[];
  jlptLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1';
  createdAt: number;
  updatedAt: number;
}

export interface CardDraft {
  id: string;
  front: string;
  back: string;
  example?: string;
}

const INIT_FLAG_KEY = 'flashmind-initialized';
const TEMPLATE_VERSION_KEY = 'flashmind-template-version';
const CURRENT_TEMPLATE_VERSION = '4.1';

// Set by App.tsx the moment a user session is detected.
// Blocks template injection so cloud data is never overwritten
// on a fresh browser before SyncManager finishes pulling.
let _userIsAuthenticated = false;
export function setStorageAuthState(authenticated: boolean) {
  _userIsAuthenticated = authenticated;
}

function initializeTemplates(): void {
  const templateVersion = localStorage.getItem(TEMPLATE_VERSION_KEY);

  // Already up-to-date — nothing to do
  if (templateVersion === CURRENT_TEMPLATE_VERSION) return;

  // If user is authenticated, cloud sync is authoritative.
  // Never inject templates — they would overwrite pulled cloud decks.
  if (_userIsAuthenticated) {
    localStorage.setItem(INIT_FLAG_KEY, 'true');
    localStorage.setItem(TEMPLATE_VERSION_KEY, CURRENT_TEMPLATE_VERSION);
    console.log('⏭️ [STORAGE] Skipping template init — user is authenticated, cloud is authoritative');
    return;
  }

  // If the user has a prior sync history, cloud data was already written.
  const lastSync = LocalStorageSync.getLastSyncTime();
  if (lastSync !== null) {
    localStorage.setItem(INIT_FLAG_KEY, 'true');
    localStorage.setItem(TEMPLATE_VERSION_KEY, CURRENT_TEMPLATE_VERSION);
    console.log('⏭️ [STORAGE] Skipping template init — synced data is authoritative');
    return;
  }

  console.log(`🎉 [STORAGE] Initializing with template version ${CURRENT_TEMPLATE_VERSION}`);

  const existingSets = LocalStorageSync.loadDecks();
  const templateIds = new Set(jlptTemplates.map(t => t.id));

  const userSets = existingSets.filter(
    set => !templateIds.has(set.id) &&
           !set.id.startsWith('jlpt-') &&
           !set.id.startsWith('n5-complete-') &&
           !set.id.startsWith('n4-complete-')
  );

  const allSets = [...jlptTemplates, ...userSets];
  LocalStorageSync.saveDecks(allSets);

  localStorage.setItem(INIT_FLAG_KEY, 'true');
  localStorage.setItem(TEMPLATE_VERSION_KEY, CURRENT_TEMPLATE_VERSION);

  console.log(`✅ [STORAGE] Initialized with ${jlptTemplates.length} templates + ${userSets.length} user sets`);
}

// READ operations
export function getAllSets(): FlashcardSet[] {
  initializeTemplates();
  return LocalStorageSync.loadDecks();
}

export function getSet(id: string): FlashcardSet | undefined {
  const sets = getAllSets();
  return sets.find(set => set.id === id);
}

export function getAllTags(): string[] {
  const sets = getAllSets();
  const tagSet = new Set<string>();
  sets.forEach(set => set.tags?.forEach(tag => tagSet.add(tag)));
  return Array.from(tagSet).sort();
}

export function getSetsByTag(tag: string): FlashcardSet[] {
  const sets = getAllSets();
  return sets.filter(set => set.tags?.includes(tag));
}

export function getSetsByJLPTLevel(level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'): FlashcardSet[] {
  const sets = getAllSets();
  return sets.filter(set => set.jlptLevel === level);
}

// CREATE operation
export function createNewSet(
  title: string,
  description: string,
  cards: CardDraft[],
  tags?: string[],
  jlptLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
): FlashcardSet {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    title,
    description,
    cards: cards.map(card => ({
      id: card.id || crypto.randomUUID(),
      front: card.front,
      back: card.back,
      example: card.example
    })),
    tags: tags || [],
    jlptLevel,
    createdAt: now,
    updatedAt: now
  };
}

export function saveSet(set: FlashcardSet): void {
  const sets = getAllSets();
  const existingIndex = sets.findIndex(s => s.id === set.id);

  if (existingIndex >= 0) {
    sets[existingIndex] = { ...set, updatedAt: Date.now() };
  } else {
    sets.push(set);
  }

  LocalStorageSync.saveDecks(sets);
  console.log(`✅ [STORAGE] Saved set: ${set.title}`);

  // ✅ FIXED: use CloudSync.pushDeck (SyncManager has no pushDeckToCloud method)
  SupabaseAuth.isAuthenticated().then(isAuth => {
    if (isAuth) {
      CloudSync.pushDeck(set).catch((error: unknown) => {
        console.error('⚠️ [STORAGE] Background sync failed:', error);
      });
    }
  });
}

// DELETE operation
export function deleteSet(id: string): void {
  SyncManager.deleteDeck(id).catch((error: unknown) => {
    console.error('⚠️ [STORAGE] Delete failed:', error);
  });
}

export function forceReloadTemplates(): void {
  localStorage.removeItem(TEMPLATE_VERSION_KEY);
  initializeTemplates();
}

export { SyncManager } from './sync/syncManager';
export type { SyncProgress, SyncResult } from './sync/syncManager';

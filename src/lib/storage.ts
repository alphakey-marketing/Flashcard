/**
 * Storage Module
 * Handles flashcard sets management with local and cloud sync
 */

import { jlptTemplates } from '../data/jlpt-templates';
import { SyncManager } from './sync/syncManager';
import { LocalStorageSync } from './sync/localStorageSync';
import { SupabaseAuth } from './sync/supabaseAuth';

// Data models
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
// Bump this version whenever the preset deck list changes.
// Existing accounts that stored the previous version will re-run
// initializeTemplates and receive the new/updated preset decks.
const CURRENT_TEMPLATE_VERSION = '4.1';

/**
 * Initialize templates on first load or when template version changes.
 */
function initializeTemplates(): void {
  const isInitialized = localStorage.getItem(INIT_FLAG_KEY);
  const templateVersion = localStorage.getItem(TEMPLATE_VERSION_KEY);

  if (!isInitialized || templateVersion !== CURRENT_TEMPLATE_VERSION) {
    console.log(`🎉 [STORAGE] Initializing with template version ${CURRENT_TEMPLATE_VERSION}`);
    
    const existingSets = LocalStorageSync.loadDecks();
    const templateIds = new Set(jlptTemplates.map(t => t.id));
    
    // Keep only user-created sets — strip out any old preset decks so they
    // get replaced cleanly with the current template list.
    const userSets = existingSets.filter(
      set => !templateIds.has(set.id) && 
             !set.id.startsWith('jlpt-') && 
             !set.id.startsWith('n5-complete-') &&
             !set.id.startsWith('n4-complete-')
    );

    // Merge templates + user sets
    const allSets = [...jlptTemplates, ...userSets];
    LocalStorageSync.saveDecks(allSets);
    
    localStorage.setItem(INIT_FLAG_KEY, 'true');
    localStorage.setItem(TEMPLATE_VERSION_KEY, CURRENT_TEMPLATE_VERSION);
    
    console.log(`✅ [STORAGE] Initialized with ${jlptTemplates.length} templates + ${userSets.length} user sets`);
  }
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

  // Background sync to cloud
  SupabaseAuth.isAuthenticated().then(isAuth => {
    if (isAuth) {
      SyncManager.pushDeckToCloud(set).catch(error => {
        console.error('⚠️ [STORAGE] Background sync failed:', error);
      });
    }
  });
}

// DELETE operation
export function deleteSet(id: string): void {
  SyncManager.deleteDeck(id).catch(error => {
    console.error('⚠️ [STORAGE] Delete failed:', error);
  });
}

// Force reload templates
export function forceReloadTemplates(): void {
  localStorage.removeItem(TEMPLATE_VERSION_KEY);
  initializeTemplates();
}

// Export sync manager for external use
export { SyncManager } from './sync/syncManager';
export type { SyncProgress, SyncResult } from './sync/syncManager';

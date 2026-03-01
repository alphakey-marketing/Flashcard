import { jlptTemplates } from '../data/jlpt-templates';

// Data models
export interface Card {
  id: string;
  front: string;
  back: string;
}

export interface FlashcardSet {
  id: string;
  title: string;
  description?: string;
  cards: Card[];
  tags?: string[]; // Tags for organization
  jlptLevel?: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'; // JLPT level category
  createdAt: number;
  updatedAt: number;
}

export interface CardDraft {
  id: string;
  front: string;
  back: string;
}

const STORAGE_KEY = 'flashcard-sets';
const INIT_FLAG_KEY = 'flashcard-initialized';
const TEMPLATE_VERSION_KEY = 'flashcard-template-version';
const CURRENT_TEMPLATE_VERSION = '2.0'; // Version 2.0 includes N4 vocabulary (500 cards)

// Helper function to get all sets from localStorage
function getSetsFromStorage(): FlashcardSet[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return [];
  }
}

// Helper function to save sets to localStorage
function saveSetsToStorage(sets: FlashcardSet[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sets));
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
}

// Initialize with JLPT templates on first load or version upgrade
function initializeTemplates(): void {
  const isInitialized = localStorage.getItem(INIT_FLAG_KEY);
  const templateVersion = localStorage.getItem(TEMPLATE_VERSION_KEY);
  
  // Check if this is first time OR if template version has changed
  if (!isInitialized || templateVersion !== CURRENT_TEMPLATE_VERSION) {
    const existingSets = getSetsFromStorage();
    
    // Get IDs of template sets (they start with 'jlpt-')
    const templateIds = new Set(jlptTemplates.map(t => t.id));
    
    // Keep user-created sets (non-template sets)
    const userSets = existingSets.filter(set => !templateIds.has(set.id) && !set.id.startsWith('jlpt-'));
    
    // Merge: new templates + user sets
    const allSets = [...jlptTemplates, ...userSets];
    
    saveSetsToStorage(allSets);
    localStorage.setItem(INIT_FLAG_KEY, 'true');
    localStorage.setItem(TEMPLATE_VERSION_KEY, CURRENT_TEMPLATE_VERSION);
    
    console.log(`Initialized with template version ${CURRENT_TEMPLATE_VERSION} - Added N4 vocabulary`);
  }
}

// READ operations
export function getAllSets(): FlashcardSet[] {
  initializeTemplates();
  return getSetsFromStorage();
}

export function getSet(id: string): FlashcardSet | undefined {
  const sets = getSetsFromStorage();
  return sets.find(set => set.id === id);
}

// Get all unique tags
export function getAllTags(): string[] {
  const sets = getSetsFromStorage();
  const tagSet = new Set<string>();
  
  sets.forEach(set => {
    set.tags?.forEach(tag => tagSet.add(tag));
  });
  
  return Array.from(tagSet).sort();
}

// Filter sets by tag
export function getSetsByTag(tag: string): FlashcardSet[] {
  const sets = getSetsFromStorage();
  return sets.filter(set => set.tags?.includes(tag));
}

// Filter sets by JLPT level
export function getSetsByJLPTLevel(level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'): FlashcardSet[] {
  const sets = getSetsFromStorage();
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
      id: card.id,
      front: card.front,
      back: card.back
    })),
    tags: tags || [],
    jlptLevel,
    createdAt: now,
    updatedAt: now
  };
}

export function saveSet(set: FlashcardSet): void {
  const sets = getSetsFromStorage();
  const existingIndex = sets.findIndex(s => s.id === set.id);
  
  if (existingIndex >= 0) {
    sets[existingIndex] = { ...set, updatedAt: Date.now() };
  } else {
    sets.push(set);
  }
  
  saveSetsToStorage(sets);
}

// DELETE operation
export function deleteSet(id: string): void {
  const sets = getSetsFromStorage();
  const filteredSets = sets.filter(set => set.id !== id);
  saveSetsToStorage(filteredSets);
}

// Force reload templates (for debugging/admin purposes)
export function forceReloadTemplates(): void {
  localStorage.removeItem(TEMPLATE_VERSION_KEY);
  initializeTemplates();
}

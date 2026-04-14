/**
 * Local Storage Module
 * Handles all localStorage operations
 */

import type { FlashcardSet } from '../storage';
import type { CardReviewData } from '../spacedRepetition';
import { storageCache } from '../storageCache';

const STORAGE_KEYS = {
  DECKS: 'flashmind-decks',
  REVIEWS: 'flashcard-review-data',
  LAST_SYNC: 'flashmind-last-sync'
} as const;

export class LocalStorageSync {
  static loadDecks(): FlashcardSet[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DECKS);
      if (!stored) {
        console.log('📊 [LOCAL] No decks in localStorage');
        return [];
      }
      const decks = JSON.parse(stored) as FlashcardSet[];
      console.log(`✅ [LOCAL] Loaded ${decks.length} decks from localStorage`);
      return decks;
    } catch (error) {
      console.error('❌ [LOCAL] Error loading decks:', error);
      return [];
    }
  }

  static saveDecks(decks: FlashcardSet[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.DECKS, JSON.stringify(decks));
      console.log(`✅ [LOCAL] Saved ${decks.length} decks to localStorage`);
    } catch (error) {
      console.error('❌ [LOCAL] Error saving decks:', error);
      throw new Error('Failed to save decks to localStorage');
    }
  }

  static loadReviews(): CardReviewData[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.REVIEWS);
      if (!stored) {
        console.log('📊 [LOCAL] No reviews in localStorage');
        return [];
      }
      const reviews = JSON.parse(stored) as CardReviewData[];
      console.log(`✅ [LOCAL] Loaded ${reviews.length} reviews from localStorage`);
      return reviews;
    } catch (error) {
      console.error('❌ [LOCAL] Error loading reviews:', error);
      return [];
    }
  }

  static saveReviews(reviews: CardReviewData[]): void {
    try {
      localStorage.setItem(STORAGE_KEYS.REVIEWS, JSON.stringify(reviews));
      // Invalidate storageCache so spacedRepetition.ts immediately reads the
      // freshly merged reviews on the next access, instead of serving stale
      // in-memory data for up to 5 seconds (the cache TTL).
      storageCache.invalidate(STORAGE_KEYS.REVIEWS);
      console.log(`✅ [LOCAL] Saved ${reviews.length} reviews to localStorage`);
    } catch (error) {
      console.error('❌ [LOCAL] Error saving reviews:', error);
      throw new Error('Failed to save reviews to localStorage');
    }
  }

  static getLastSyncTime(): number | null {
    const stored = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return stored ? parseInt(stored, 10) : null;
  }

  static setLastSyncTime(timestamp: number = Date.now()): void {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, timestamp.toString());
    console.log(`✅ [LOCAL] Updated last sync time: ${new Date(timestamp).toISOString()}`);
  }

  static clearAll(): void {
    localStorage.removeItem(STORAGE_KEYS.DECKS);
    localStorage.removeItem(STORAGE_KEYS.REVIEWS);
    localStorage.removeItem(STORAGE_KEYS.LAST_SYNC);
    storageCache.invalidate(STORAGE_KEYS.REVIEWS);
    console.log('✅ [LOCAL] Cleared all data');
  }

  static getStorageSize(): string {
    let total = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage[key].length + key.length;
      }
    }
    return (total / (1024 * 1024)).toFixed(2) + ' MB';
  }
}

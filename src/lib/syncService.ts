/**
 * syncService.ts — thin compatibility shim
 *
 * Home.tsx imports from here. All real logic lives in CloudSync / SyncManager.
 * This file exists only to avoid a large Home.tsx refactor.
 *
 * DO NOT add new logic here. Use CloudSync / SyncManager directly.
 */

import { CloudSync } from './sync/cloudSync';
import { SyncManager } from './sync/syncManager';
import type { FlashcardSet } from './storage';
import type { CardReviewData } from './spacedRepetition';

export const syncService = {
  /**
   * Pull all decks + reviews for a user from cloud.
   * Returns plain FlashcardSet[] with raw local IDs — no namespacing.
   */
  async pullAll(userId: string): Promise<{ decks: FlashcardSet[], reviews: CardReviewData[] }> {
    const [decks, reviews] = await Promise.all([
      CloudSync.pullDecks(),
      CloudSync.pullReviews()
    ]);
    return { decks, reviews };
  },

  /**
   * Push a single deck to cloud.
   */
  async pushDeck(deck: FlashcardSet, userId: string): Promise<void> {
    await CloudSync.pushDeck(deck);
  },

  /**
   * Delete a deck from cloud and local storage.
   */
  async deleteDeck(deckId: string): Promise<void> {
    await SyncManager.deleteDeck(deckId);
  },

  /**
   * Push a review to cloud.
   */
  async pushReview(review: CardReviewData, userId: string): Promise<void> {
    await CloudSync.pushReview(review);
  }
};

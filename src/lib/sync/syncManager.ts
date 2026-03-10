/**
 * Sync Manager
 * Orchestrates synchronization between local storage and cloud
 */

import { SupabaseAuth } from './supabaseAuth';
import { CloudSync } from './cloudSync';
import { LocalStorageSync } from './localStorageSync';
import type { FlashcardSet } from '../storage';
import type { CardReviewData } from '../spacedRepetition';

export interface SyncProgress {
  phase: 'checking-auth' | 'pulling' | 'merging' | 'pushing' | 'complete' | 'error';
  message: string;
  progress?: { current: number; total: number };
}

export interface SyncResult {
  success: boolean;
  decksAdded: number;
  decksUpdated: number;
  decksPushed: number;
  error?: string;
}

export class SyncManager {
  private static onProgressCallback?: (progress: SyncProgress) => void;

  /**
   * Set callback for sync progress updates
   */
  static setProgressCallback(callback: (progress: SyncProgress) => void) {
    this.onProgressCallback = callback;
  }

  private static updateProgress(progress: SyncProgress) {
    console.log(`🔄 [SYNC] ${progress.phase}: ${progress.message}`);
    this.onProgressCallback?.(progress);
  }

  /**
   * Main sync method - call this to sync everything
   */
  static async performSync(): Promise<SyncResult> {
    console.log('\n='.repeat(50));
    console.log('🔄 [SYNC] Starting full sync...');
    console.log('='.repeat(50));

    try {
      // Phase 1: Check authentication
      this.updateProgress({
        phase: 'checking-auth',
        message: 'Verifying authentication...'
      });

      const isAuth = await SupabaseAuth.isAuthenticated();
      if (!isAuth) {
        throw new Error('Not authenticated. Please sign in first.');
      }

      const userId = await SupabaseAuth.getUserId();
      console.log(`✅ [SYNC] Authenticated as: ${userId}`);

      // Phase 2: Pull from cloud
      this.updateProgress({
        phase: 'pulling',
        message: 'Downloading data from cloud...'
      });

      const cloudDecks = await CloudSync.pullDecks();
      const cloudReviews = await CloudSync.pullReviews();

      console.log(`📊 [SYNC] Cloud has: ${cloudDecks.length} decks, ${cloudReviews.length} reviews`);

      // Phase 3: Load local data
      const localDecks = LocalStorageSync.loadDecks();
      const localReviews = LocalStorageSync.loadReviews();

      console.log(`📱 [SYNC] Local has: ${localDecks.length} decks, ${localReviews.length} reviews`);

      // Phase 4: Merge decks
      this.updateProgress({
        phase: 'merging',
        message: 'Merging local and cloud data...'
      });

      const { merged, added, updated } = this.mergeDecks(localDecks, cloudDecks);

      console.log(`🔀 [SYNC] Merge result: ${merged.length} total, ${added} new from cloud, ${updated} updated`);

      // Phase 5: Find decks to push to cloud
      const decksToPush = localDecks.filter(
        localDeck => !cloudDecks.find(cloudDeck => cloudDeck.id === localDeck.id)
      );

      console.log(`📤 [SYNC] Found ${decksToPush.length} local decks not in cloud`);

      // Phase 6: Push to cloud
      if (decksToPush.length > 0) {
        this.updateProgress({
          phase: 'pushing',
          message: `Uploading ${decksToPush.length} decks to cloud...`,
          progress: { current: 0, total: decksToPush.length }
        });

        for (let i = 0; i < decksToPush.length; i++) {
          const deck = decksToPush[i];
          try {
            await CloudSync.pushDeck(deck);
            this.updateProgress({
              phase: 'pushing',
              message: `Uploaded: ${deck.title}`,
              progress: { current: i + 1, total: decksToPush.length }
            });
          } catch (error) {
            console.error(`❌ [SYNC] Failed to push deck "${deck.title}":`, error);
            throw error;
          }
        }
      }

      // Phase 7: Merge reviews
      const mergedReviews = this.mergeReviews(localReviews, cloudReviews);
      console.log(`🔀 [SYNC] Merged ${mergedReviews.length} reviews`);

      // Phase 8: Save everything locally
      LocalStorageSync.saveDecks(merged);
      LocalStorageSync.saveReviews(mergedReviews);
      LocalStorageSync.setLastSyncTime();

      // Phase 9: Complete
      this.updateProgress({
        phase: 'complete',
        message: 'Sync completed successfully!'
      });

      console.log('='.repeat(50));
      console.log('✅ [SYNC] Sync complete!');
      console.log(`   Total decks: ${merged.length}`);
      console.log(`   Total reviews: ${mergedReviews.length}`);
      console.log(`   Decks pushed to cloud: ${decksToPush.length}`);
      console.log('='.repeat(50) + '\n');

      return {
        success: true,
        decksAdded: added,
        decksUpdated: updated,
        decksPushed: decksToPush.length
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [SYNC] Sync failed:', errorMessage);

      this.updateProgress({
        phase: 'error',
        message: `Sync failed: ${errorMessage}`
      });

      return {
        success: false,
        decksAdded: 0,
        decksUpdated: 0,
        decksPushed: 0,
        error: errorMessage
      };
    }
  }

  /**
   * Merge local and cloud decks
   * Cloud data wins for existing decks (server is source of truth)
   */
  private static mergeDecks(
    localDecks: FlashcardSet[],
    cloudDecks: FlashcardSet[]
  ): { merged: FlashcardSet[]; added: number; updated: number } {
    const deckMap = new Map<string, FlashcardSet>();
    let added = 0;
    let updated = 0;

    // Add all local decks first
    localDecks.forEach(deck => {
      deckMap.set(deck.id, deck);
    });

    // Merge in cloud decks (cloud wins)
    cloudDecks.forEach(cloudDeck => {
      if (deckMap.has(cloudDeck.id)) {
        // Update existing
        updated++;
      } else {
        // New from cloud
        added++;
      }
      deckMap.set(cloudDeck.id, cloudDeck);
    });

    return {
      merged: Array.from(deckMap.values()),
      added,
      updated
    };
  }

  /**
   * Merge local and cloud reviews
   * Keep the most recent review for each card
   */
  private static mergeReviews(
    localReviews: CardReviewData[],
    cloudReviews: CardReviewData[]
  ): CardReviewData[] {
    const reviewMap = new Map<string, CardReviewData>();

    // Add all local reviews
    localReviews.forEach(review => {
      const key = `${review.setId}-${review.cardId}`;
      reviewMap.set(key, review);
    });

    // Merge cloud reviews (keep most recent)
    cloudReviews.forEach(cloudReview => {
      const key = `${cloudReview.setId}-${cloudReview.cardId}`;
      const existing = reviewMap.get(key);

      if (!existing || cloudReview.lastReviewed > existing.lastReviewed) {
        reviewMap.set(key, cloudReview);
      }
    });

    return Array.from(reviewMap.values());
  }

  /**
   * Force push a specific deck to cloud
   */
  static async pushDeckToCloud(deck: FlashcardSet): Promise<void> {
    console.log(`📤 [SYNC] Force pushing deck: ${deck.title}`);
    await CloudSync.pushDeck(deck);
    console.log(`✅ [SYNC] Deck pushed successfully`);
  }

  /**
   * Delete a deck from both local and cloud
   */
  static async deleteDeck(deckId: string): Promise<void> {
    console.log(`🗑️ [SYNC] Deleting deck: ${deckId}`);

    // Delete from cloud
    const isAuth = await SupabaseAuth.isAuthenticated();
    if (isAuth) {
      try {
        await CloudSync.deleteDeck(deckId);
      } catch (error) {
        console.error('⚠️ [SYNC] Failed to delete from cloud:', error);
        // Continue to delete locally even if cloud delete fails
      }
    }

    // Delete from local
    const localDecks = LocalStorageSync.loadDecks();
    const filtered = localDecks.filter(d => d.id !== deckId);
    LocalStorageSync.saveDecks(filtered);

    console.log(`✅ [SYNC] Deck deleted`);
  }
}

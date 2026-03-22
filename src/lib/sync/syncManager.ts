/**
 * Sync Manager
 * Orchestrates synchronization between local storage and cloud.
 *
 * MERGE STRATEGY:
 * - Decks: last-write-wins based on updatedAt timestamp.
 *   If the same deck exists in both local and cloud, whichever
 *   has the newer updatedAt is kept. New decks from either side
 *   are always added.
 * - Decks that exist only locally are pushed to cloud.
 * - Decks that exist only in cloud are written to local.
 * - Reviews: keep the most recently reviewed entry per card.
 *   Reviews that exist only locally, or are newer locally, are pushed to cloud.
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
  reviewsPushed: number;
  error?: string;
}

export class SyncManager {
  private static onProgressCallback?: (progress: SyncProgress) => void;

  static setProgressCallback(callback: (progress: SyncProgress) => void) {
    this.onProgressCallback = callback;
  }

  private static updateProgress(progress: SyncProgress) {
    console.log(`🔄 [SYNC] ${progress.phase}: ${progress.message}`);
    this.onProgressCallback?.(progress);
  }

  /**
   * Full bidirectional sync:
   *   1. Pull cloud state
   *   2. Merge with local state (last-write-wins)
   *   3. Push local-only decks to cloud
   *   4. Merge reviews (last-write-wins)
   *   5. Push local-only or newer reviews to cloud
   *   6. Save merged state locally
   */
  static async performSync(): Promise<SyncResult> {
    console.log('\n' + '='.repeat(50));
    console.log('🔄 [SYNC] Starting full sync...');
    console.log('='.repeat(50));

    try {
      // Phase 1: Auth
      this.updateProgress({ phase: 'checking-auth', message: 'Verifying authentication...' });
      const isAuth = await SupabaseAuth.isAuthenticated();
      if (!isAuth) throw new Error('Not authenticated. Please sign in first.');

      const userId = await SupabaseAuth.getUserId();
      console.log(`✅ [SYNC] Authenticated as: ${userId}`);

      // Phase 2: Pull
      this.updateProgress({ phase: 'pulling', message: 'Downloading data from cloud...' });
      const cloudDecks = await CloudSync.pullDecks();
      const cloudReviews = await CloudSync.pullReviews();
      console.log(`☁️  [SYNC] Cloud: ${cloudDecks.length} decks, ${cloudReviews.length} reviews`);

      // Phase 3: Load local
      const localDecks = LocalStorageSync.loadDecks();
      const localReviews = LocalStorageSync.loadReviews();
      console.log(`📱 [SYNC] Local: ${localDecks.length} decks, ${localReviews.length} reviews`);

      // Phase 4: Merge decks
      this.updateProgress({ phase: 'merging', message: 'Merging local and cloud data...' });
      const { merged, added, updated } = this.mergeDecks(localDecks, cloudDecks);
      console.log(`🔀 [SYNC] Merge result: ${merged.length} total, ${added} added, ${updated} updated`);

      // Phase 5: Find decks that exist locally but NOT in cloud → push them
      const cloudDeckIds = new Set(cloudDecks.map(d => d.id));
      const decksToPush = localDecks.filter(d => !cloudDeckIds.has(d.id));
      console.log(`📤 [SYNC] ${decksToPush.length} local decks to push to cloud`);

      // Phase 6: Push local-only decks
      if (decksToPush.length > 0) {
        this.updateProgress({
          phase: 'pushing',
          message: `Uploading ${decksToPush.length} deck(s) to cloud...`,
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
          } catch (err) {
            console.error(`❌ [SYNC] Failed to push "${deck.title}":`, err);
            throw err;
          }
        }
      }

      // Phase 7: Merge reviews (last-write-wins)
      const mergedReviews = this.mergeReviews(localReviews, cloudReviews);
      console.log(`🔀 [SYNC] Merged ${mergedReviews.length} reviews`);

      // Phase 8: Persist merged state locally
      LocalStorageSync.saveDecks(merged);
      LocalStorageSync.saveReviews(mergedReviews);
      LocalStorageSync.setLastSyncTime();

      // Phase 9: Push local-only or newer reviews back to cloud
      const cloudReviewMap = new Map<string, CardReviewData>();
      cloudReviews.forEach(r => cloudReviewMap.set(`${r.setId}::${r.cardId}`, r));

      const reviewsToPush = mergedReviews.filter(r => {
        const key = `${r.setId}::${r.cardId}`;
        const cloudReview = cloudReviewMap.get(key);
        // Push if: not in cloud at all, OR local version is newer
        return !cloudReview || r.lastReviewed > cloudReview.lastReviewed;
      });

      console.log(`📤 [SYNC] ${reviewsToPush.length} reviews to push to cloud`);

      if (reviewsToPush.length > 0) {
        this.updateProgress({
          phase: 'pushing',
          message: `Uploading ${reviewsToPush.length} review(s) to cloud...`
        });

        for (const review of reviewsToPush) {
          try {
            await CloudSync.pushReview(review);
          } catch (err) {
            // Non-fatal: log and continue so one bad review doesn't block everything
            console.error(`⚠️ [SYNC] Failed to push review for card ${review.cardId} (non-fatal):`, err);
          }
        }

        console.log(`✅ [SYNC] Reviews pushed: ${reviewsToPush.length}`);
      }

      this.updateProgress({ phase: 'complete', message: 'Sync completed successfully!' });

      console.log('='.repeat(50));
      console.log(`✅ [SYNC] Done. ${merged.length} decks, ${mergedReviews.length} reviews`);
      console.log('='.repeat(50) + '\n');

      return {
        success: true,
        decksAdded: added,
        decksUpdated: updated,
        decksPushed: decksToPush.length,
        reviewsPushed: reviewsToPush.length
      };

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ [SYNC] Failed:', msg);
      this.updateProgress({ phase: 'error', message: `Sync failed: ${msg}` });
      return { success: false, decksAdded: 0, decksUpdated: 0, decksPushed: 0, reviewsPushed: 0, error: msg };
    }
  }

  /**
   * Merge local and cloud deck lists.
   *
   * Rules:
   * - If a deck exists only locally  → keep it locally (will be pushed)
   * - If a deck exists only in cloud → add it locally
   * - If a deck exists in both       → keep whichever has the newer updatedAt
   *
   * Both sides use the same raw IDs, so comparison is a straight string match.
   */
  private static mergeDecks(
    localDecks: FlashcardSet[],
    cloudDecks: FlashcardSet[]
  ): { merged: FlashcardSet[]; added: number; updated: number } {
    const deckMap = new Map<string, FlashcardSet>();
    let added = 0;
    let updated = 0;

    // Seed map with all local decks
    localDecks.forEach(deck => deckMap.set(deck.id, deck));

    // Merge cloud decks in
    cloudDecks.forEach(cloudDeck => {
      const local = deckMap.get(cloudDeck.id);
      if (!local) {
        // New deck from cloud — add it locally
        deckMap.set(cloudDeck.id, cloudDeck);
        added++;
      } else if (cloudDeck.updatedAt > local.updatedAt) {
        // Cloud version is newer — prefer it
        deckMap.set(cloudDeck.id, cloudDeck);
        updated++;
      }
      // else: local version is same age or newer — keep it
    });

    return { merged: Array.from(deckMap.values()), added, updated };
  }

  /**
   * Merge local and cloud reviews.
   * For each (deckId, cardId) pair, keep the entry with the most
   * recent lastReviewed timestamp.
   */
  private static mergeReviews(
    localReviews: CardReviewData[],
    cloudReviews: CardReviewData[]
  ): CardReviewData[] {
    const reviewMap = new Map<string, CardReviewData>();

    const upsert = (review: CardReviewData) => {
      const key = `${review.setId}::${review.cardId}`;
      const existing = reviewMap.get(key);
      if (!existing || review.lastReviewed > existing.lastReviewed) {
        reviewMap.set(key, review);
      }
    };

    localReviews.forEach(upsert);
    cloudReviews.forEach(upsert);

    return Array.from(reviewMap.values());
  }

  /**
   * Force-push a single deck to cloud (called by storage.ts on every save).
   */
  static async pushDeckToCloud(deck: FlashcardSet): Promise<void> {
    console.log(`📤 [SYNC] Background push: "${deck.title}"`);
    await CloudSync.pushDeck(deck);
  }

  /**
   * Delete a deck from both local storage and cloud.
   */
  static async deleteDeck(deckId: string): Promise<void> {
    console.log(`🗑️ [SYNC] Deleting deck: ${deckId}`);

    // Cloud delete first (best-effort)
    const isAuth = await SupabaseAuth.isAuthenticated();
    if (isAuth) {
      try {
        await CloudSync.deleteDeck(deckId);
      } catch (err) {
        console.error('⚠️ [SYNC] Cloud delete failed (continuing local delete):', err);
      }
    }

    // Local delete
    const localDecks = LocalStorageSync.loadDecks();
    LocalStorageSync.saveDecks(localDecks.filter(d => d.id !== deckId));
    console.log(`✅ [SYNC] Deck deleted`);
  }
}
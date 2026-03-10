/**
 * Cloud Sync Module
 * Handles all Supabase database operations with RLS support
 */

import { supabase } from '../supabaseClient';
import { SupabaseAuth } from './supabaseAuth';
import type { FlashcardSet } from '../storage';
import type { CardReviewData } from '../spacedRepetition';

export interface SyncResult {
  success: boolean;
  decksCount: number;
  cardsCount: number;
  error?: string;
}

/**
 * Namespace a local ID to be unique per-user in the cloud.
 * e.g. "n4-complete-1" + userId -> "n4-complete-1__abc12345"
 * If the ID already contains the user suffix, return it unchanged.
 */
function toCloudId(localId: string, userId: string): string {
  const suffix = `__${userId.slice(0, 8)}`;
  return localId.endsWith(suffix) ? localId : `${localId}${suffix}`;
}

export class CloudSync {
  /**
   * Pull all user's decks from cloud
   */
  static async pullDecks(): Promise<FlashcardSet[]> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();
    
    console.log(`📊 [CLOUD] Pulling decks for user: ${userId}`);

    const { data, error } = await supabase
      .from('decks')
      .select(`
        *,
        cards (*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ [CLOUD] Error pulling decks:', error);
      throw new Error(`Failed to pull decks: ${error.message}`);
    }

    const decks: FlashcardSet[] = (data || []).map((deck: any) => ({
      id: deck.id,
      title: deck.title,
      description: deck.description || '',
      tags: deck.tags || [],
      jlptLevel: deck.jlpt_level,
      createdAt: new Date(deck.created_at).getTime(),
      updatedAt: new Date(deck.updated_at).getTime(),
      cards: (deck.cards || [])
        .sort((a: any, b: any) => a.position - b.position)
        .map((card: any) => ({
          id: card.id,
          front: card.front,
          back: card.back,
          example: card.example || undefined
        }))
    }));

    console.log(`✅ [CLOUD] Pulled ${decks.length} decks from cloud`);
    return decks;
  }

  /**
   * Push a single deck (and its cards) to cloud.
   *
   * All IDs are namespaced with a user-specific suffix before hitting the DB.
   * This guarantees:
   *  - No two users ever share the same deck/card primary key.
   *  - No RLS USING-expression violation (every row is owned by auth.uid()).
   *  - No duplicate-key errors on re-sync (upsert on the namespaced ID).
   */
  static async pushDeck(deck: FlashcardSet): Promise<void> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();

    const cloudDeckId = toCloudId(deck.id, userId);

    console.log(`\n📤 [CLOUD] Pushing deck: "${deck.title}"`);
    console.log(`   - Local ID : ${deck.id}`);
    console.log(`   - Cloud ID : ${cloudDeckId}`);
    console.log(`   - User ID  : ${userId}`);
    console.log(`   - Cards    : ${deck.cards.length}`);

    const deckData = {
      id: cloudDeckId,
      user_id: userId,
      title: deck.title,
      description: deck.description || '',
      tags: deck.tags || [],
      jlpt_level: deck.jlptLevel || null,
      created_at: new Date(deck.createdAt).toISOString(),
      updated_at: new Date(deck.updatedAt).toISOString()
    };

    // Safe upsert: the namespaced ID is unique per-user so this row is
    // always owned by auth.uid(). Both INSERT and UPDATE satisfy RLS.
    const { error: deckError } = await supabase
      .from('decks')
      .upsert([deckData], { onConflict: 'id' });

    if (deckError) {
      console.error(`❌ [CLOUD] Failed to push deck "${deck.title}":`, deckError);
      throw new Error(`Failed to sync deck: ${deckError.message}`);
    }

    console.log(`   ✅ Deck metadata synced`);

    if (deck.cards.length > 0) {
      await this.pushCards(cloudDeckId, userId, deck.cards);
    }

    console.log(`✅ [CLOUD] Complete: "${deck.title}"\n`);
  }

  /**
   * Push cards for a deck.
   * Card IDs are also namespaced per-user to avoid PK collisions.
   * user_id is included so the cards RLS policy is satisfied.
   */
  private static async pushCards(
    cloudDeckId: string,
    userId: string,
    cards: Array<{ id: string; front: string; back: string; example?: string }>
  ): Promise<void> {
    console.log(`   🃏 Syncing ${cards.length} cards...`);

    const cardsData = cards.map((card, index) => ({
      id: toCloudId(card.id, userId),
      deck_id: cloudDeckId,
      user_id: userId,
      front: card.front,
      back: card.back,
      example: card.example || null,
      position: index,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const CHUNK_SIZE = 50;
    for (let i = 0; i < cardsData.length; i += CHUNK_SIZE) {
      const chunk = cardsData.slice(i, i + CHUNK_SIZE);

      const { error } = await supabase
        .from('cards')
        .upsert(chunk, { onConflict: 'id' });

      if (error) {
        console.error(`   ❌ Failed to sync cards ${i}-${i + chunk.length}:`, error);
        throw new Error(`Failed to sync cards: ${error.message}`);
      }

      console.log(`   ✅ Cards ${Math.min(i + chunk.length, cards.length)}/${cards.length}`);
    }
  }

  /**
   * Delete a deck from cloud
   */
  static async deleteDeck(deckId: string): Promise<void> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();

    const cloudDeckId = toCloudId(deckId, userId);
    console.log(`🗑️ [CLOUD] Deleting deck: ${cloudDeckId}`);

    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('id', cloudDeckId);

    if (error) {
      console.error('❌ [CLOUD] Failed to delete deck:', error);
      throw new Error(`Failed to delete deck: ${error.message}`);
    }

    console.log('✅ [CLOUD] Deck deleted');
  }

  /**
   * Pull review data from cloud
   */
  static async pullReviews(): Promise<CardReviewData[]> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();

    console.log(`📊 [CLOUD] Pulling reviews for user: ${userId}`);

    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [CLOUD] Error pulling reviews:', error);
      throw new Error(`Failed to pull reviews: ${error.message}`);
    }

    const reviews: CardReviewData[] = (data || []).map((r: any) => ({
      cardId: r.card_id,
      setId: r.deck_id,
      easeFactor: r.ease_factor,
      interval: r.interval,
      repetitions: r.repetition,
      nextReview: new Date(r.next_review_date).getTime(),
      status: r.repetition >= 5 ? 'mastered' : r.repetition > 0 ? 'reviewing' : 'learning',
      totalReviews: r.total_reviews,
      knowItCount: 0,
      againCount: r.lapses,
      masteredCount: 0,
      lastReviewed: new Date(r.last_review_date).getTime(),
      createdAt: new Date(r.last_review_date).getTime(),
      updatedAt: new Date(r.last_review_date).getTime()
    }));

    console.log(`✅ [CLOUD] Pulled ${reviews.length} reviews`);
    return reviews;
  }

  /**
   * Push a single review to cloud
   */
  static async pushReview(review: CardReviewData): Promise<void> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();

    const reviewData = {
      id: `${userId}-${review.cardId}`,
      user_id: userId,
      card_id: review.cardId,
      deck_id: review.setId,
      interval: review.interval,
      repetition: review.repetitions,
      ease_factor: review.easeFactor,
      next_review_date: new Date(review.nextReview).toISOString(),
      last_review_date: new Date(review.lastReviewed).toISOString(),
      total_reviews: review.totalReviews,
      lapses: review.againCount
    };

    const { error } = await supabase
      .from('reviews')
      .upsert(reviewData, {
        onConflict: 'user_id,card_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('⚠️ [CLOUD] Failed to push review:', error);
      // Don't throw - reviews are non-critical
    }
  }
}

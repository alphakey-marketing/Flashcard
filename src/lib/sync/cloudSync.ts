/**
 * Cloud Sync Module
 * Handles all Supabase database operations with RLS support.
 *
 * ID SCHEME: We store the exact same IDs locally and in the cloud.
 * RLS isolation is achieved via the user_id column on every row —
 * NOT by namespacing primary keys. This keeps the code simple and
 * avoids any local-vs-cloud ID mismatch.
 *
 * NOTE: The `cards` table has NO user_id column. It is owned by its
 * parent deck row (which does have user_id). Because of this, we
 * cannot rely on Supabase's implicit foreign-key join (select '*, cards (*)')
 * to return cards on a second device — RLS on cards has no user_id to
 * filter on and may return empty results.
 *
 * Instead we pull decks first, then pull cards explicitly filtered by
 * deck_id IN (...) using the user's own deck IDs, and stitch them
 * together in memory.
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

export class CloudSync {
  /**
   * Pull all user's decks from cloud, with their cards.
   *
   * Two-step approach:
   *  1. Fetch decks filtered by user_id (RLS-safe)
   *  2. Fetch cards filtered by deck_id IN (user's deck IDs) (RLS-safe)
   *  3. Stitch cards onto their parent decks in memory
   */
  static async pullDecks(): Promise<FlashcardSet[]> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();
    console.log(`📊 [CLOUD] Pulling decks for user: ${userId}`);

    // Step 1: fetch decks
    const { data: deckRows, error: deckError } = await supabase
      .from('decks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (deckError) {
      console.error('❌ [CLOUD] Error pulling decks:', deckError);
      throw new Error(`Failed to pull decks: ${deckError.message}`);
    }

    if (!deckRows || deckRows.length === 0) {
      console.log('✅ [CLOUD] No decks in cloud');
      return [];
    }

    const deckIds = deckRows.map((d: any) => d.id);
    console.log(`📊 [CLOUD] Found ${deckIds.length} decks, fetching their cards...`);

    // Step 2: fetch all cards for these decks in one query
    const { data: cardRows, error: cardError } = await supabase
      .from('cards')
      .select('*')
      .in('deck_id', deckIds)
      .order('position', { ascending: true });

    if (cardError) {
      console.error('❌ [CLOUD] Error pulling cards:', cardError);
      throw new Error(`Failed to pull cards: ${cardError.message}`);
    }

    // Step 3: group cards by deck_id
    const cardsByDeckId = new Map<string, any[]>();
    for (const card of (cardRows || [])) {
      const list = cardsByDeckId.get(card.deck_id) || [];
      list.push(card);
      cardsByDeckId.set(card.deck_id, list);
    }

    // Step 4: build FlashcardSet objects
    const decks: FlashcardSet[] = deckRows.map((deck: any) => ({
      id: deck.id,
      title: deck.title,
      description: deck.description || '',
      tags: deck.tags || [],
      jlptLevel: deck.jlpt_level,
      createdAt: new Date(deck.created_at).getTime(),
      updatedAt: new Date(deck.updated_at).getTime(),
      cards: (cardsByDeckId.get(deck.id) || []).map((card: any) => ({
        id: card.id,
        front: card.front,
        back: card.back,
        example: card.example || undefined
      }))
    }));

    const totalCards = decks.reduce((sum, d) => sum + d.cards.length, 0);
    console.log(`✅ [CLOUD] Pulled ${decks.length} decks with ${totalCards} cards total`);
    return decks;
  }

  /**
   * Push a single deck (and its cards) to cloud.
   * Uses the raw local ID — no namespacing.
   * user_id is always included so RLS INSERT policy is satisfied.
   */
  static async pushDeck(deck: FlashcardSet): Promise<void> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();
    console.log(`\n📤 [CLOUD] Pushing deck: "${deck.title}" (id: ${deck.id})`);

    const deckData = {
      id: deck.id,
      user_id: userId,
      title: deck.title,
      description: deck.description || '',
      tags: deck.tags || [],
      jlpt_level: deck.jlptLevel || null,
      created_at: new Date(deck.createdAt).toISOString(),
      updated_at: new Date(deck.updatedAt).toISOString()
    };

    const { error: deckError } = await supabase
      .from('decks')
      .upsert([deckData], { onConflict: 'id' });

    if (deckError) {
      console.error(`❌ [CLOUD] Failed to push deck "${deck.title}":`, deckError);
      throw new Error(`Failed to sync deck: ${deckError.message}`);
    }

    console.log(`   ✅ Deck metadata synced`);

    if (deck.cards.length > 0) {
      await this.pushCards(deck.id, deck.cards);
    }

    console.log(`✅ [CLOUD] Complete: "${deck.title}"\n`);
  }

  /**
   * Push cards for a deck.
   * Cards are linked to their parent deck via deck_id only.
   * No user_id column exists on the cards table.
   */
  private static async pushCards(
    deckId: string,
    cards: Array<{ id: string; front: string; back: string; example?: string }>
  ): Promise<void> {
    console.log(`   🃏 Syncing ${cards.length} cards...`);

    const cardsData = cards.map((card, index) => ({
      id: card.id,
      deck_id: deckId,
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
        console.error(`   ❌ Failed to sync cards chunk:`, error);
        throw new Error(`Failed to sync cards: ${error.message}`);
      }

      console.log(`   ✅ Cards ${Math.min(i + chunk.length, cards.length)}/${cards.length}`);
    }
  }

  /**
   * Delete a deck from cloud using the raw local ID.
   * The .eq('user_id') guard ensures only the owner can delete.
   */
  static async deleteDeck(deckId: string): Promise<void> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();
    console.log(`🗑️ [CLOUD] Deleting deck: ${deckId} for user ${userId}`);

    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('id', deckId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [CLOUD] Failed to delete deck:', error);
      throw new Error(`Failed to delete deck: ${error.message}`);
    }

    console.log('✅ [CLOUD] Deck deleted');
  }

  /**
   * Pull review data from cloud.
   * card_id and deck_id in the DB match local IDs exactly.
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
      totalReviews: r.total_reviews || 0,
      knowItCount: 0,
      againCount: r.lapses || 0,
      masteredCount: 0,
      lastReviewed: new Date(r.last_review_date).getTime(),
      createdAt: new Date(r.last_review_date).getTime(),
      updatedAt: new Date(r.last_review_date).getTime()
    }));

    console.log(`✅ [CLOUD] Pulled ${reviews.length} reviews`);
    return reviews;
  }

  /**
   * Push a single review to cloud.
   * card_id and deck_id stored as raw local IDs.
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
      total_reviews: review.totalReviews || 0,
      lapses: review.againCount || 0
    };

    const { error } = await supabase
      .from('reviews')
      .upsert(reviewData, {
        onConflict: 'user_id,card_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.warn('⚠️ [CLOUD] Failed to push review (non-fatal):', error.message);
    }
  }
}

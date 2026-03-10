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
   * Push a single deck to cloud
   */
  static async pushDeck(deck: FlashcardSet): Promise<void> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();
    
    console.log(`\n📤 [CLOUD] Pushing deck: "${deck.title}"`);
    console.log(`   - Deck ID: ${deck.id}`);
    console.log(`   - User ID: ${userId}`);
    console.log(`   - Cards: ${deck.cards.length}`);

    // Check if deck already exists for THIS user
    const { data: existing, error: checkError } = await supabase
      .from('decks')
      .select('id')
      .eq('id', deck.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      console.error(`❌ [CLOUD] Error checking deck existence:`, checkError);
      throw new Error(`Failed to check deck: ${checkError.message}`);
    }

    if (existing) {
      console.log(`   ℹ️ Deck already exists in cloud, updating...`);
    }

    // Prepare deck data for Supabase
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

    // Use upsert - this works because RLS allows updates to own decks
    const { error: deckError } = await supabase
      .from('decks')
      .upsert(deckData, {
        onConflict: 'id',
        ignoreDuplicates: false
      });

    if (deckError) {
      // If it's a duplicate key error AND deck doesn't belong to this user,
      // it means the deck ID collides with another user's deck
      if (deckError.code === '23505' && !existing) {
        console.warn(`   ⚠️ Deck ID collision with another user's deck`);
        console.warn(`   ℹ️ Skipping this deck - already exists with different owner`);
        return; // Skip this deck silently
      }
      
      console.error(`❌ [CLOUD] Failed to push deck "${deck.title}":`, deckError);
      throw new Error(`Failed to sync deck: ${deckError.message}`);
    }

    console.log(`   ✅ Deck metadata synced`);

    // Sync cards if there are any
    if (deck.cards.length > 0) {
      await this.pushCards(deck.id, deck.cards);
    }

    console.log(`✅ [CLOUD] Complete: "${deck.title}"\n`);
  }

  /**
   * Push cards for a deck
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

    // Insert cards in chunks to avoid payload size limits
    const CHUNK_SIZE = 50;
    for (let i = 0; i < cardsData.length; i += CHUNK_SIZE) {
      const chunk = cardsData.slice(i, i + CHUNK_SIZE);
      
      const { error } = await supabase
        .from('cards')
        .upsert(chunk, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

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
    await SupabaseAuth.ensureAuthenticated();
    
    console.log(`🗑️ [CLOUD] Deleting deck: ${deckId}`);

    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('id', deckId);

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

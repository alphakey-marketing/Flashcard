/** Cloud Sync Module */
import { supabase } from '../supabaseClient';
import { SupabaseAuth } from './supabaseAuth';
import type { FlashcardSet } from '../storage';
import type { CardReviewData } from '../spacedRepetition';

const PAGE_SIZE = 1000;

export class CloudSync {
  static async pullDecks(): Promise<FlashcardSet[]> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();
    console.log(`📊 [CLOUD] Pulling decks for user: ${userId}`);

    const { data: deckRows, error: deckError } = await supabase
      .from('decks')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null) // only active decks
      .order('created_at', { ascending: false });

    if (deckError) {
      console.error('❌ [CLOUD] Error pulling decks:', deckError);
      throw new Error(`Failed to pull decks: ${deckError.message}`);
    }

    if (!deckRows || deckRows.length === 0) {
      console.log('✅ [CLOUD] No active decks in cloud');
      return [];
    }

    const deckIds = deckRows.map((d: any) => d.id);
    console.log(`📊 [CLOUD] Found ${deckIds.length} active decks, fetching their cards...`);

    const allCardRows: any[] = [];
    let from = 0;
    while (true) {
      const { data: cardPage, error: cardError } = await supabase
        .from('cards')
        .select('*')
        .in('deck_id', deckIds)
        .is('deleted_at', null) // only active cards
        .order('position', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (cardError) {
        console.error('❌ [CLOUD] Error pulling cards:', cardError);
        throw new Error(`Failed to pull cards: ${cardError.message}`);
      }

      allCardRows.push(...(cardPage || []));

      if (!cardPage || cardPage.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const cardsByDeckId = new Map<string, any[]>();
    for (const card of allCardRows) {
      const list = cardsByDeckId.get(card.deck_id) || [];
      list.push(card);
      cardsByDeckId.set(card.deck_id, list);
    }

    const decks: FlashcardSet[] = deckRows.map((deck: any) => ({
      id: deck.id,
      title: deck.title,
      description: deck.description || '',
      tags: deck.tags || [],
      jlptLevel: deck.jlpt_level,
      createdAt: new Date(deck.created_at).getTime(),
      updatedAt: new Date(deck.updated_at || deck.created_at).getTime(),
      cards: (cardsByDeckId.get(deck.id) || []).map((card: any) => ({
        id: card.id,
        front: card.front,
        back: card.back,
        example: card.example || undefined,
      })),
    }));

    const totalCards = decks.reduce((sum, d) => sum + d.cards.length, 0);
    console.log(`✅ [CLOUD] Pulled ${decks.length} decks with ${totalCards} active cards`);
    return decks;
  }

  static async pushDeck(deck: FlashcardSet): Promise<void> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();
    console.log(`📤 [CLOUD] Pushing deck: "${deck.title}" (id: ${deck.id})`);

    const deckData = {
      id: deck.id,
      user_id: userId,
      title: deck.title,
      description: deck.description || '',
      tags: deck.tags || [],
      jlpt_level: deck.jlptLevel || null,
      created_at: new Date(deck.createdAt).toISOString(),
      updated_at: new Date(deck.updatedAt).toISOString(),
      deleted_at: null, // clear deleted_at on push
      deleted_by: null,  // clear deleted_by on push
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
      updated_at: new Date().toISOString(),
      deleted_at: null,  // ensure cards are not marked as deleted when pushed
      deleted_by: null,
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

  static async deleteDeck(deckId: string): Promise<void> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();
    console.log(`🗑️ [CLOUD] Soft‑deleting deck: ${deckId} for user ${userId}`);

    const { error } = await supabase
      .from('decks')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', deckId)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ [CLOUD] Failed to soft‑delete deck:', error);
      throw new Error(`Failed to delete deck: ${error.message}`);
    }

    console.log('✅ [CLOUD] Deck soft‑deleted');
  }

  static async softDeleteCard(cardId: string): Promise<void> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();
    console.log(`🗑️ [CLOUD] Soft‑deleting card: ${cardId} for user ${userId}`);

    const { error } = await supabase
      .from('cards')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
      })
      .eq('id', cardId);

    if (error) {
      console.error('❌ [CLOUD] Failed to soft‑delete card:', error);
      throw new Error(`Failed to delete card: ${error.message}`);
    }

    console.log('✅ [CLOUD] Card soft‑deleted');
  }

  static async pullReviews(): Promise<CardReviewData[]> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();
    console.log(`📊 [CLOUD] Pulling reviews for user: ${userId}`);

    const allRows: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', userId)
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('❌ [CLOUD] Error pulling reviews:', error);
        throw new Error(`Failed to pull reviews: ${error.message}`);
      }

      if (!data) break;
      allRows.push(...data);

      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    const reviews: CardReviewData[] = allRows.map((r: any) => ({
      cardId: r.card_id,
      setId: r.deck_id,
      easeFactor: r.ease_factor,
      interval: r.interval,
      repetitions: r.repetition,
      knowItCount: r.know_it_count || 0,
      againCount: r.lapses || 0,
      masteredCount: r.mastered_count || 0,
      status: (r.status as CardReviewData['status']) ?? (
        r.repetition >= 5 ? 'mastered' : r.repetition > 0 ? 'reviewing' : 'learning'
      ),
      nextReview: new Date(r.next_review_date).getTime(),
      totalReviews: r.total_reviews || 0,
      lastReviewed: new Date(r.last_review_date).getTime(),
      createdAt: r.created_at
        ? new Date(r.created_at).getTime()
        : new Date(r.last_review_date).getTime(),
      updatedAt: new Date(r.last_review_date).getTime(),
    }));

    console.log(`✅ [CLOUD] Pulled ${reviews.length} reviews`);
    return reviews;
  }

  static async pushReview(review: CardReviewData): Promise<void> {
    const { userId } = await SupabaseAuth.ensureAuthenticated();

    const id = `${userId}-${review.cardId}`;

    const reviewData = {
      id,
      user_id: userId,
      card_id: review.cardId,
      deck_id: review.setId,
      ease_factor: review.easeFactor,
      interval: review.interval,
      repetition: review.repetitions,
      total_reviews: review.totalReviews || 0,
      lapses: review.againCount || 0,
      status: review.status,
      know_it_count: review.knowItCount || 0,
      mastered_count: review.masteredCount || 0,
      next_review_date: new Date(review.nextReview).toISOString(),
      last_review_date: new Date(review.lastReviewed).toISOString(),
      created_at: new Date(review.createdAt).toISOString(),
    };

    const { error: insertError } = await supabase
      .from('reviews')
      .insert(reviewData);

    if (!insertError) {
      console.log(`✅ [CLOUD] Review inserted: ${review.cardId}`);
      return;
    }

    if (insertError.code === '23505') {
      const { error: updateError } = await supabase
        .from('reviews')
        .update({
          id,
          deck_id: reviewData.deck_id,
          ease_factor: reviewData.ease_factor,
          interval: reviewData.interval,
          repetition: reviewData.repetition,
          total_reviews: reviewData.total_reviews,
          lapses: reviewData.lapses,
          status: reviewData.status,
          know_it_count: reviewData.know_it_count,
          mastered_count: reviewData.mastered_count,
          next_review_date: reviewData.next_review_date,
          last_review_date: reviewData.last_review_date,
        })
        .eq('user_id', userId)
        .eq('card_id', review.cardId);

      if (updateError) {
        console.warn('⚠️ [CLOUD] Failed to update review (non‑fatal):', updateError.message);
      } else {
        console.log(`✅ [CLOUD] Review updated: ${review.cardId}`);
      }
    } else {
      console.warn('⚠️ [CLOUD] Failed to insert review (non‑fatal):', insertError.message);
    }
  }
}

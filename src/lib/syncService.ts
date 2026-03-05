import { supabase } from './supabaseClient';
import { FlashcardSet } from './storage';
import { CardReviewData } from './spacedRepetition';

export const syncService = {
  /**
   * Pull all data from Supabase and save to LocalStorage
   */
  async pullAll(userId: string): Promise<{ decks: FlashcardSet[], reviews: CardReviewData[] }> {
    // 1. Fetch decks and cards
    const { data: dbDecks, error: decksError } = await supabase
      .from('decks')
      .select(`
        *,
        cards (*)
      `)
      .eq('user_id', userId);

    if (decksError) throw decksError;

    // 2. Fetch reviews
    const { data: dbReviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId);

    if (reviewsError) throw reviewsError;

    // Map database models to local models
    const mappedDecks: FlashcardSet[] = (dbDecks || []).map((dbDeck: any) => ({
      id: dbDeck.id,
      title: dbDeck.title,
      description: dbDeck.description || '',
      tags: dbDeck.tags || [],
      jlptLevel: dbDeck.jlpt_level,
      createdAt: new Date(dbDeck.created_at).getTime(),
      updatedAt: new Date(dbDeck.updated_at).getTime(),
      cards: (dbDeck.cards || []).sort((a: any, b: any) => a.position - b.position).map((c: any) => ({
        id: c.id,
        front: c.front,
        back: c.back,
        example: c.example || undefined
      }))
    }));

    const mappedReviews: CardReviewData[] = (dbReviews || []).map((r: any) => ({
      cardId: r.card_id,
      setId: r.deck_id,
      easeFactor: r.ease_factor,
      interval: r.interval,
      repetitions: r.repetition,
      nextReview: new Date(r.next_review_date).getTime(),
      status: r.repetition >= 5 ? 'mastered' : r.repetition > 0 ? 'reviewing' : 'learning',
      totalReviews: r.total_reviews,
      knowItCount: 0, // Simplified for now since schema doesn't perfectly match
      againCount: r.lapses,
      masteredCount: 0,
      lastReviewed: new Date(r.last_review_date).getTime(),
      createdAt: new Date(r.last_review_date).getTime(), // Fallback
      updatedAt: new Date(r.last_review_date).getTime()
    }));

    return { decks: mappedDecks, reviews: mappedReviews };
  },

  /**
   * Push a single deck (and its cards) to Supabase
   */
  async pushDeck(deck: FlashcardSet, userId: string) {
    // Upsert deck
    const { error: deckError } = await supabase
      .from('decks')
      .upsert({
        id: deck.id,
        user_id: userId,
        title: deck.title,
        description: deck.description,
        tags: deck.tags,
        jlpt_level: deck.jlptLevel,
        created_at: new Date(deck.createdAt).toISOString(),
        updated_at: new Date(deck.updatedAt).toISOString()
      }, { onConflict: 'id' });

    if (deckError) {
      console.error('Error syncing deck:', deckError);
      return;
    }

    // Upsert cards in chunks to avoid payload limits
    const cardsToUpsert = deck.cards.map((card, index) => ({
      id: card.id,
      deck_id: deck.id,
      front: card.front,
      back: card.back,
      example: card.example || null,
      position: index
    }));

    const CHUNK_SIZE = 100;
    for (let i = 0; i < cardsToUpsert.length; i += CHUNK_SIZE) {
      const chunk = cardsToUpsert.slice(i, i + CHUNK_SIZE);
      const { error: cardsError } = await supabase
        .from('cards')
        .upsert(chunk, { onConflict: 'id' });

      if (cardsError) {
        console.error('Error syncing cards chunk:', cardsError);
      }
    }
  },

  /**
   * Delete a deck from Supabase
   */
  async deleteDeck(deckId: string) {
    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('id', deckId);
      
    if (error) console.error('Error deleting deck from cloud:', error);
  },

  /**
   * Push a review to Supabase
   */
  async pushReview(review: CardReviewData, userId: string) {
    const { error } = await supabase
      .from('reviews')
      .upsert({
        id: `${userId}-${review.cardId}`, // Composite predictable ID
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
      }, { onConflict: 'user_id, card_id' }); // Requires unique constraint in DB on user_id, card_id

    if (error) {
      console.error('Error syncing review:', error);
    }
  }
};

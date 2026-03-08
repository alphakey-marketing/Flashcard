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

    if (decksError) {
      console.error('Error pulling decks:', decksError);
      throw decksError;
    }

    // 2. Fetch reviews
    const { data: dbReviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId);

    if (reviewsError) {
      console.error('Error pulling reviews:', reviewsError);
      throw reviewsError;
    }

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

    console.log(`✅ Pulled ${mappedDecks.length} decks and ${mappedReviews.length} reviews from cloud`);
    return { decks: mappedDecks, reviews: mappedReviews };
  },

  /**
   * Push a single deck (and its cards) to Supabase
   */
  async pushDeck(deck: FlashcardSet, userId: string) {
    console.log(`📤 Pushing deck "${deck.title}" (ID: ${deck.id}) to cloud...`);
    console.log(`   User ID: ${userId}`);
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.error('❌ User not authenticated!', authError);
      throw new Error('User not authenticated. Please sign in again.');
    }
    
    if (user.id !== userId) {
      console.error('❌ User ID mismatch!', { expected: userId, actual: user.id });
      throw new Error('User ID mismatch. Please sign in again.');
    }
    
    console.log(`✅ User authenticated: ${user.id}`);
    
    // Check if deck already exists in cloud
    const { data: existingDeck, error: checkError } = await supabase
      .from('decks')
      .select('id')
      .eq('id', deck.id)
      .maybeSingle();
    
    if (checkError) {
      console.error('❌ Error checking existing deck:', checkError);
      throw new Error(`Failed to check existing deck: ${checkError.message}`);
    }
    
    const deckData = {
      id: deck.id,
      user_id: userId, // Use the verified userId
      title: deck.title,
      description: deck.description || '',
      tags: deck.tags || [],
      jlpt_level: deck.jlptLevel || null,
      created_at: new Date(deck.createdAt).toISOString(),
      updated_at: new Date(deck.updatedAt).toISOString()
    };
    
    console.log('📦 Deck data to sync:', deckData);
    
    // Use INSERT or UPDATE based on whether deck exists
    let deckError;
    if (existingDeck) {
      console.log('   Deck exists, updating...');
      const result = await supabase
        .from('decks')
        .update(deckData)
        .eq('id', deck.id);
      deckError = result.error;
    } else {
      console.log('   Deck is new, inserting...');
      const result = await supabase
        .from('decks')
        .insert(deckData);
      deckError = result.error;
    }

    if (deckError) {
      console.error(`❌ Error syncing deck "${deck.title}":`, deckError);
      console.error('   Full error details:', JSON.stringify(deckError, null, 2));
      throw new Error(`Failed to sync deck: ${deckError.message}`);
    }

    console.log(`✅ Deck "${deck.title}" synced, now syncing ${deck.cards.length} cards...`);

    // Delete old cards that are not in the current deck
    if (existingDeck) {
      const currentCardIds = deck.cards.map(c => c.id);
      const { error: deleteError } = await supabase
        .from('cards')
        .delete()
        .eq('deck_id', deck.id)
        .not('id', 'in', `(${currentCardIds.join(',')})`);
      
      if (deleteError) {
        console.error('Warning: Failed to delete old cards:', deleteError);
      }
    }

    // Upsert cards in chunks to avoid payload limits
    const cardsToUpsert = deck.cards.map((card, index) => ({
      id: card.id,
      deck_id: deck.id,
      front: card.front,
      back: card.back,
      example: card.example || null,
      position: index,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    const CHUNK_SIZE = 100;
    for (let i = 0; i < cardsToUpsert.length; i += CHUNK_SIZE) {
      const chunk = cardsToUpsert.slice(i, i + CHUNK_SIZE);
      const { error: cardsError } = await supabase
        .from('cards')
        .upsert(chunk, { onConflict: 'id' });

      if (cardsError) {
        console.error(`❌ Error syncing cards chunk ${i}-${i + chunk.length}:`, cardsError);
        throw new Error(`Failed to sync cards: ${cardsError.message}`);
      }
      
      console.log(`✅ Synced cards ${i + 1}-${Math.min(i + chunk.length, deck.cards.length)} of ${deck.cards.length}`);
    }
    
    console.log(`✅ Successfully synced deck "${deck.title}" with all ${deck.cards.length} cards`);
  },

  /**
   * Delete a deck from Supabase
   */
  async deleteDeck(deckId: string) {
    const { error } = await supabase
      .from('decks')
      .delete()
      .eq('id', deckId);
      
    if (error) {
      console.error('Error deleting deck from cloud:', error);
      throw error;
    }
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
      // Don't throw for review errors to avoid blocking deck sync
    }
  }
};

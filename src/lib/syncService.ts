import { supabase, debugSession } from './supabaseClient';
import { FlashcardSet } from './storage';
import { CardReviewData } from './spacedRepetition';

/**
 * Verify user is authenticated and return session
 */
async function ensureAuthenticated() {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('❌ Auth error:', error);
    throw new Error(`Authentication error: ${error.message}`);
  }
  
  if (!session || !session.user) {
    console.error('❌ No active session');
    throw new Error('No active session. Please sign in again.');
  }
  
  console.log('✅ Auth verified - User:', session.user.id);
  return session;
}

export const syncService = {
  /**
   * Pull all data from Supabase and save to LocalStorage
   */
  async pullAll(userId: string): Promise<{ decks: FlashcardSet[], reviews: CardReviewData[] }> {
    console.log('📊 Pulling data from cloud for user:', userId);
    
    // Verify session first
    await ensureAuthenticated();
    
    // 1. Fetch decks and cards
    const { data: dbDecks, error: decksError } = await supabase
      .from('decks')
      .select(`
        *,
        cards (*)
      `)
      .eq('user_id', userId);

    if (decksError) {
      console.error('❌ Error pulling decks:', decksError);
      throw decksError;
    }

    // 2. Fetch reviews
    const { data: dbReviews, error: reviewsError } = await supabase
      .from('reviews')
      .select('*')
      .eq('user_id', userId);

    if (reviewsError) {
      console.error('❌ Error pulling reviews:', reviewsError);
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
      knowItCount: 0,
      againCount: r.lapses,
      masteredCount: 0,
      lastReviewed: new Date(r.last_review_date).getTime(),
      createdAt: new Date(r.last_review_date).getTime(),
      updatedAt: new Date(r.last_review_date).getTime()
    }));

    console.log(`✅ Pulled ${mappedDecks.length} decks and ${mappedReviews.length} reviews from cloud`);
    return { decks: mappedDecks, reviews: mappedReviews };
  },

  /**
   * Push a single deck (and its cards) to Supabase
   */
  async pushDeck(deck: FlashcardSet, userId: string) {
    console.log(`\n📤 [SYNC START] Deck: "${deck.title}"`);
    console.log(`   Deck ID: ${deck.id}`);
    console.log(`   User ID: ${userId}`);
    console.log(`   Cards: ${deck.cards.length}`);
    
    // CRITICAL: Verify authentication and get fresh session
    const session = await ensureAuthenticated();
    
    // Double check user ID matches
    if (session.user.id !== userId) {
      const error = `User ID mismatch! Session: ${session.user.id}, Expected: ${userId}`;
      console.error(`❌ ${error}`);
      throw new Error(error);
    }
    
    console.log(`✅ Session verified, access token present: ${!!session.access_token}`);
    
    // Prepare deck data
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
    
    console.log('📦 Deck data prepared:', {
      id: deckData.id,
      user_id: deckData.user_id,
      title: deckData.title,
      has_tags: deckData.tags.length > 0
    });
    
    // Check if deck exists
    console.log('   Checking if deck exists in cloud...');
    const { data: existingDeck, error: checkError } = await supabase
      .from('decks')
      .select('id, user_id')
      .eq('id', deck.id)
      .maybeSingle();
    
    if (checkError) {
      console.error('❌ Error checking existing deck:', checkError);
      throw new Error(`Failed to check existing deck: ${checkError.message}`);
    }
    
    if (existingDeck) {
      console.log(`   ➡️ Deck exists, updating... (owner: ${existingDeck.user_id})`);
    } else {
      console.log('   ➕ Deck is new, inserting...');
    }
    
    // Perform insert or update
    let deckError;
    if (existingDeck) {
      const { error } = await supabase
        .from('decks')
        .update(deckData)
        .eq('id', deck.id);
      deckError = error;
    } else {
      // For INSERT, use the session's access token explicitly
      const { error } = await supabase
        .from('decks')
        .insert([deckData]); // Note: wrap in array for single insert
      deckError = error;
    }

    if (deckError) {
      console.error(`\n❌ [SYNC FAILED] Deck: "${deck.title}"`);
      console.error('   Error code:', deckError.code);
      console.error('   Error message:', deckError.message);
      console.error('   Error details:', deckError.details);
      console.error('   Error hint:', deckError.hint);
      console.error('   User ID in data:', userId);
      console.error('   Session user ID:', session.user.id);
      
      // Show helpful message
      if (deckError.code === '42501') {
        console.error('\n🚫 RLS Policy Violation Detected!');
        console.error('   This means the database is blocking the insert.');
        console.error('   Action required:');
        console.error('   1. Go to Supabase Dashboard');
        console.error('   2. SQL Editor');
        console.error('   3. Run: SELECT auth.uid();');
        console.error(`   4. Verify it returns: ${userId}`);
        console.error('   5. Check RLS policies on decks table');
      }
      
      throw new Error(`Failed to sync deck: ${deckError.message}`);
    }

    console.log(`✅ Deck "${deck.title}" synced successfully`);
    console.log(`   Now syncing ${deck.cards.length} cards...`);

    // Sync cards
    if (deck.cards.length > 0) {
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

      const CHUNK_SIZE = 50; // Reduced chunk size for stability
      for (let i = 0; i < cardsToUpsert.length; i += CHUNK_SIZE) {
        const chunk = cardsToUpsert.slice(i, i + CHUNK_SIZE);
        const { error: cardsError } = await supabase
          .from('cards')
          .upsert(chunk, { onConflict: 'id' });

        if (cardsError) {
          console.error(`❌ Error syncing cards chunk ${i}-${i + chunk.length}:`, cardsError);
          throw new Error(`Failed to sync cards: ${cardsError.message}`);
        }
        
        const progress = Math.min(i + chunk.length, deck.cards.length);
        console.log(`   ✅ Cards ${progress}/${deck.cards.length}`);
      }
    }
    
    console.log(`✅ [SYNC COMPLETE] Deck: "${deck.title}" with all ${deck.cards.length} cards\n`);
  },

  /**
   * Delete a deck from Supabase
   */
  async deleteDeck(deckId: string) {
    await ensureAuthenticated();
    
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
    await ensureAuthenticated();
    
    const { error } = await supabase
      .from('reviews')
      .upsert({
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
      }, { onConflict: 'user_id, card_id' });

    if (error) {
      console.error('Error syncing review:', error);
      // Don't throw for review errors to avoid blocking deck sync
    }
  }
};

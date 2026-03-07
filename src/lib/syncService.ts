// Sync service for synchronizing data with Supabase
import { FlashcardSet } from './storage';
import { CardReviewData } from './spacedRepetition';
import { supabase } from '../supabaseClient';

class SyncService {
  async pushDeck(deck: FlashcardSet, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('decks')
        .upsert({
          id: deck.id,
          user_id: userId,
          title: deck.title,
          description: deck.description,
          cards: deck.cards,
          tags: deck.tags,
          jlpt_level: deck.jlptLevel,
          created_at: new Date(deck.createdAt).toISOString(),
          updated_at: new Date(deck.updatedAt).toISOString()
        });

      if (error) {
        console.error('Error syncing deck:', error);
      }
    } catch (error) {
      console.error('Error pushing deck to cloud:', error);
    }
  }

  async deleteDeck(deckId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('decks')
        .delete()
        .eq('id', deckId);

      if (error) {
        console.error('Error deleting deck:', error);
      }
    } catch (error) {
      console.error('Error deleting deck from cloud:', error);
    }
  }

  async pushReview(review: CardReviewData, userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('card_reviews')
        .upsert({
          card_id: review.cardId,
          deck_id: review.setId,
          user_id: userId,
          ease_factor: review.easeFactor,
          interval: review.interval,
          repetitions: review.repetitions,
          next_review: new Date(review.nextReview).toISOString(),
          status: review.status,
          total_reviews: review.totalReviews,
          last_reviewed: new Date(review.lastReviewed).toISOString(),
          updated_at: new Date(review.updatedAt).toISOString()
        });

      if (error) {
        console.error('Error syncing review:', error);
      }
    } catch (error) {
      console.error('Error pushing review to cloud:', error);
    }
  }

  async pullDecks(userId: string): Promise<FlashcardSet[]> {
    try {
      const { data, error } = await supabase
        .from('decks')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching decks:', error);
        return [];
      }

      return (data || []).map((deck: any) => ({
        id: deck.id,
        title: deck.title,
        description: deck.description,
        cards: deck.cards,
        tags: deck.tags,
        jlptLevel: deck.jlpt_level,
        createdAt: new Date(deck.created_at).getTime(),
        updatedAt: new Date(deck.updated_at).getTime()
      }));
    } catch (error) {
      console.error('Error pulling decks from cloud:', error);
      return [];
    }
  }

  async pullReviews(userId: string): Promise<CardReviewData[]> {
    try {
      const { data, error } = await supabase
        .from('card_reviews')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching reviews:', error);
        return [];
      }

      return (data || []).map((review: any) => ({
        cardId: review.card_id,
        setId: review.deck_id,
        easeFactor: review.ease_factor,
        interval: review.interval,
        repetitions: review.repetitions,
        nextReview: new Date(review.next_review).getTime(),
        status: review.status,
        totalReviews: review.total_reviews,
        knowItCount: review.know_it_count || 0,
        againCount: review.again_count || 0,
        masteredCount: review.mastered_count || 0,
        lastReviewed: new Date(review.last_reviewed).getTime(),
        createdAt: new Date(review.created_at).getTime(),
        updatedAt: new Date(review.updated_at).getTime()
      }));
    } catch (error) {
      console.error('Error pulling reviews from cloud:', error);
      return [];
    }
  }
}

export const syncService = new SyncService();

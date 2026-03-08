/**
 * Spaced Repetition System using SM-2 Algorithm
 * Modified to use 3-button system: Again / Know It / Mastered
 */

import { storageCache } from './storageCache';
import { syncService } from './syncService';
import { supabase } from './supabaseClient';

export interface CardReviewData {
  cardId: string;
  setId: string;
  
  // SM-2 Algorithm data
  easeFactor: number;      // Default: 2.5, Range: 1.3-2.5+
  interval: number;        // Days until next review
  repetitions: number;     // Consecutive successful reviews
  nextReview: number;      // Timestamp (ms) for next review
  
  // Card status
  status: 'learning' | 'reviewing' | 'mastered'; // Learning state
  
  // Performance tracking
  totalReviews: number;    // Total number of times reviewed
  knowItCount: number;     // Times marked as "Know It"
  againCount: number;      // Times marked as "Again" (struggling)
  masteredCount: number;   // Times marked as "Mastered"
  
  // Timestamps
  lastReviewed: number;    // Last review timestamp
  createdAt: number;       // First time card was studied
  updatedAt: number;       // Last update timestamp
}

export interface ReviewSession {
  setId: string;
  sessionId: string;
  startTime: number;
  endTime?: number;
  cardsReviewed: number;
  cardsAgain: number;
  cardsKnowIt: number;
  cardsMastered: number;
}

// 3-button rating system
export type ReviewRating = 'again' | 'know_it' | 'mastered';

const STORAGE_KEY_REVIEWS = 'flashcard-review-data';
const STORAGE_KEY_SESSIONS = 'flashcard-review-sessions';
const CACHE_TTL = 5000; // 5 seconds cache for review data

// SM-2 Algorithm Constants
const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;

// Auth context logic (similar to storage)
let currentUserId: string | null = null;
export function setReviewUserId(id: string | null) {
  currentUserId = id;
}

/**
 * Direct override for syncing cloud down to local storage
 * Implements a smart merge to prevent losing local status
 */
export function overrideReviewsWithCloud(cloudReviews: CardReviewData[]) {
  const localReviews = getReviewDataFromStorage();
  const mergedReviews = [...cloudReviews];

  // Restore local status/counts for reviews that haven't changed in the cloud
  // This prevents the "Active Practice" challenges from disappearing when
  // the status field (which isn't stored in the cloud) gets wiped out by a sync.
  for (let i = 0; i < mergedReviews.length; i++) {
    const cloudReview = mergedReviews[i];
    const localReview = localReviews.find(
      r => r.cardId === cloudReview.cardId && r.setId === cloudReview.setId
    );

    if (localReview) {
      // If the cloud review is the same age or older than our local review,
      // it means the cloud didn't have any newer data. We should preserve
      // our local status and counts.
      if (cloudReview.lastReviewed <= localReview.lastReviewed) {
        mergedReviews[i] = {
          ...cloudReview,
          status: localReview.status, // Preserve 'mastered' status!
          knowItCount: localReview.knowItCount || cloudReview.knowItCount,
          masteredCount: localReview.masteredCount || cloudReview.masteredCount
        };
      }
    }
  }

  // Also add any local reviews that haven't been synced to the cloud yet
  for (const localReview of localReviews) {
    if (!mergedReviews.some(r => r.cardId === localReview.cardId && r.setId === localReview.setId)) {
      mergedReviews.push(localReview);
    }
  }

  saveReviewDataToStorage(mergedReviews);
}

export function initializeCardReview(setId: string, cardId: string): CardReviewData {
  const now = Date.now();
  return {
    cardId,
    setId,
    easeFactor: DEFAULT_EASE_FACTOR,
    interval: 0,
    repetitions: 0,
    nextReview: now, 
    status: 'learning',
    totalReviews: 0,
    knowItCount: 0,
    againCount: 0,
    masteredCount: 0,
    lastReviewed: 0,
    createdAt: now,
    updatedAt: now,
  };
}

function getReviewDataFromStorage(): CardReviewData[] {
  try {
    const data = storageCache.get<CardReviewData[]>(STORAGE_KEY_REVIEWS, CACHE_TTL);
    
    if (!data) return [];
    
    return data.map((item: any) => {
      if (!item.status) {
        return {
          ...item,
          status: item.repetitions >= 5 ? 'mastered' : item.repetitions > 0 ? 'reviewing' : 'learning',
          knowItCount: (item.correctCount || 0) + (item.hardCount || 0),
          masteredCount: 0,
          againCount: item.againCount || 0
        };
      }
      return item;
    });
  } catch (error) {
    console.error('Error reading review data:', error);
    return [];
  }
}

function saveReviewDataToStorage(data: CardReviewData[]): void {
  try {
    storageCache.set(STORAGE_KEY_REVIEWS, data);
  } catch (error) {
    console.error('Error saving review data:', error);
  }
}

export function getCardReviewData(setId: string, cardId: string): CardReviewData {
  const allData = getReviewDataFromStorage();
  const existing = allData.find(d => d.setId === setId && d.cardId === cardId);
  
  if (existing) {
    return existing;
  }
  
  const newData = initializeCardReview(setId, cardId);
  allData.push(newData);
  saveReviewDataToStorage(allData);
  return newData;
}

export function getSetReviewData(setId: string): CardReviewData[] {
  const allData = getReviewDataFromStorage();
  return allData.filter(d => d.setId === setId);
}

export function calculateNextReview(
  rating: ReviewRating,
  currentData: CardReviewData
): CardReviewData {
  const now = Date.now();
  let { easeFactor, interval, repetitions, status } = currentData;
  
  const totalReviews = currentData.totalReviews + 1;
  let knowItCount = currentData.knowItCount;
  let againCount = currentData.againCount;
  let masteredCount = currentData.masteredCount;
  
  switch (rating) {
    case 'again':
      againCount++;
      repetitions = 0;
      interval = 1; 
      status = 'learning';
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
      break;
      
    case 'know_it':
      knowItCount++;
      if (repetitions === 0) {
        interval = 2;
      } else if (repetitions === 1) {
        interval = 4;
      } else {
        interval = Math.round(interval * 1.5);
      }
      status = 'reviewing';
      repetitions++;
      break;
      
    case 'mastered':
      masteredCount++;
      if (repetitions === 0) {
        interval = 7;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      status = 'mastered';
      repetitions++;
      easeFactor = Math.min(3.0, easeFactor + 0.15);
      break;
  }
  
  const nextReview = now + (interval * 24 * 60 * 60 * 1000);
  
  return {
    ...currentData,
    easeFactor,
    interval,
    repetitions,
    nextReview,
    status,
    totalReviews,
    knowItCount,
    againCount,
    masteredCount,
    lastReviewed: now,
    updatedAt: now,
  };
}

export function saveCardReview(
  setId: string,
  cardId: string,
  rating: ReviewRating
): CardReviewData {
  const allData = getReviewDataFromStorage();
  const index = allData.findIndex(d => d.setId === setId && d.cardId === cardId);
  
  let currentData: CardReviewData;
  if (index >= 0) {
    currentData = allData[index];
  } else {
    currentData = initializeCardReview(setId, cardId);
  }
  
  const updatedData = calculateNextReview(rating, currentData);
  
  if (index >= 0) {
    allData[index] = updatedData;
  } else {
    allData.push(updatedData);
  }
  
  saveReviewDataToStorage(allData);

  // Background sync
  if (currentUserId) {
    syncService.pushReview(updatedData, currentUserId);
  }

  return updatedData;
}

export function getDueCards(setId: string): CardReviewData[] {
  const now = Date.now();
  const setData = getSetReviewData(setId);
  return setData.filter(card => 
    card.nextReview <= now || 
    card.status === 'learning' || 
    card.status === 'reviewing'
  );
}

export function getLearningCards(setId: string): CardReviewData[] {
  const setData = getSetReviewData(setId);
  return setData.filter(card => card.status === 'learning' || card.status === 'reviewing');
}

export function getDifficultCards(
  setId: string,
  threshold: number = 3
): CardReviewData[] {
  const setData = getSetReviewData(setId);
  return setData
    .filter(card => card.againCount >= threshold)
    .sort((a, b) => b.againCount - a.againCount);
}

export function getMasteredCards(setId: string): CardReviewData[] {
  const setData = getSetReviewData(setId);
  return setData.filter(card => card.status === 'mastered');
}

export function getSetStudyStats(setId: string, totalCards: number) {
  const setData = getSetReviewData(setId);
  const now = Date.now();
  
  const dueCards = setData.filter(card => card.nextReview <= now);
  const learningCards = getLearningCards(setId);
  const masteredCards = getMasteredCards(setId);
  const difficultCards = getDifficultCards(setId);
  
  const totalReviews = setData.reduce((sum, card) => sum + card.totalReviews, 0);
  const averageEaseFactor = setData.length > 0
    ? setData.reduce((sum, card) => sum + card.easeFactor, 0) / setData.length
    : DEFAULT_EASE_FACTOR;
  
  const totalAttempts = setData.reduce(
    (sum, card) => sum + card.totalReviews,
    0
  );
  const totalKnowIt = setData.reduce(
    (sum, card) => sum + card.knowItCount + card.masteredCount,
    0
  );
  const successRate = totalAttempts > 0 ? (totalKnowIt / totalAttempts) * 100 : 0;
  
  return {
    totalCards,
    studiedCards: setData.length,
    newCards: totalCards - setData.length,
    dueCards: dueCards.length,
    learningCards: learningCards.length,
    masteredCards: masteredCards.length,
    difficultCards: difficultCards.length,
    totalReviews,
    averageEaseFactor: Math.round(averageEaseFactor * 100) / 100,
    successRate: Math.round(successRate * 100) / 100,
  };
}

export function startReviewSession(setId: string): ReviewSession {
  const session: ReviewSession = {
    setId,
    sessionId: crypto.randomUUID(),
    startTime: Date.now(),
    cardsReviewed: 0,
    cardsAgain: 0,
    cardsKnowIt: 0,
    cardsMastered: 0,
  };
  
  return session;
}

export function endReviewSession(session: ReviewSession): ReviewSession {
  const endedSession = {
    ...session,
    endTime: Date.now(),
  };
  
  try {
    const sessions = storageCache.get<ReviewSession[]>(STORAGE_KEY_SESSIONS) || [];
    sessions.push(endedSession);
    
    if (sessions.length > 100) {
      sessions.shift();
    }
    
    storageCache.set(STORAGE_KEY_SESSIONS, sessions);

    // If we wanted to sync sessions to study_sessions table, we would add that here.
    if (currentUserId && endedSession.endTime) {
      supabase.from('study_sessions').insert({
        user_id: currentUserId,
        deck_id: endedSession.setId,
        start_time: new Date(endedSession.startTime).toISOString(),
        end_time: new Date(endedSession.endTime).toISOString(),
        duration_seconds: Math.floor((endedSession.endTime - endedSession.startTime) / 1000),
        cards_studied: endedSession.cardsReviewed,
        cards_mastered: endedSession.cardsMastered
      }).then(({ error }) => {
        if (error) console.error("Error syncing session: ", error);
      });
    }

  } catch (error) {
    console.error('Error saving session:', error);
  }
  
  return endedSession;
}

export function getRecentSessions(
  setId: string,
  limit: number = 10
): ReviewSession[] {
  try {
    const sessions = storageCache.get<ReviewSession[]>(STORAGE_KEY_SESSIONS) || [];
    return sessions
      .filter(s => s.setId === setId)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  } catch (error) {
    console.error('Error loading sessions:', error);
    return [];
  }
}

// ============================================
// COMPATIBILITY EXPORTS FOR LearnSession.tsx
// ============================================

/**
 * Compatibility wrapper: getCardReview
 * Maps to getCardReviewData with reversed parameter order
 */
export function getCardReview(cardId: string, setId: string): CardReviewData {
  return getCardReviewData(setId, cardId);
}

/**
 * Compatibility wrapper: recordReview
 * Maps 4-quality system (again/hard/good/easy) to 3-button system
 */
export function recordReview(
  cardId: string,
  setId: string,
  quality: 'again' | 'hard' | 'good' | 'easy'
): CardReviewData {
  // Map 4-quality to 3-button rating system
  const rating: ReviewRating =
    quality === 'again' ? 'again' :
    quality === 'hard' ? 'again' :      // Conservative: treat "hard" as "again"
    quality === 'good' ? 'know_it' :
    'mastered';  // "easy" maps to "mastered"

  return saveCardReview(setId, cardId, rating);
}

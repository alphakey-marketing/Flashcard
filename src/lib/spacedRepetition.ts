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
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: number;
  
  // Card status
  status: 'learning' | 'reviewing' | 'mastered';

  // Learning step within the short-interval phase (0 = just started/failed, 1 = passed 10-min step)
  learningStep?: number;
  // Number of times this card has lapsed (failed after becoming a mature review card)
  lapses?: number;
  
  // Performance tracking
  totalReviews: number;
  knowItCount: number;
  againCount: number;
  masteredCount: number;
  
  // Timestamps
  lastReviewed: number;
  createdAt: number;
  updatedAt: number;
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

export type ReviewRating = 'again' | 'know_it' | 'mastered';

const STORAGE_KEY_REVIEWS = 'flashcard-review-data';
const STORAGE_KEY_SESSIONS = 'flashcard-review-sessions';
const CACHE_TTL = 5000;

const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Daily workload caps — configurable at app level. */
export const DAILY_LIMITS = {
  maxNewPerDay: 20,
  maxLearningPerDay: 30,
  maxReviewPerDay: 100,
  maxTotalPerDay: 150,
};

let currentUserId: string | null = null;
export function setReviewUserId(id: string | null) {
  currentUserId = id;
}

/**
 * Direct override for syncing cloud down to local storage.
 * Kept for compatibility — SyncManager.performSync() is the authoritative sync path.
 */
export function overrideReviewsWithCloud(cloudReviews: CardReviewData[]) {
  const localReviews = getReviewDataFromStorage();
  const mergedReviews = [...cloudReviews];

  for (let i = 0; i < mergedReviews.length; i++) {
    const cloudReview = mergedReviews[i];
    const localReview = localReviews.find(
      r => r.cardId === cloudReview.cardId && r.setId === cloudReview.setId
    );

    if (localReview && cloudReview.lastReviewed <= localReview.lastReviewed) {
      mergedReviews[i] = {
        ...cloudReview,
        status: localReview.status,
        knowItCount: localReview.knowItCount || cloudReview.knowItCount,
        masteredCount: localReview.masteredCount || cloudReview.masteredCount
      };
    }
  }

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
      // Migration path for legacy records that pre-date the status field.
      // Use ?? to NEVER overwrite counts that already exist on synced data.
      if (!item.status) {
        return {
          ...item,
          status: item.repetitions >= 5 ? 'mastered' : item.repetitions > 0 ? 'reviewing' : 'learning',
          knowItCount: item.knowItCount ?? ((item.correctCount || 0) + (item.hardCount || 0)),
          masteredCount: item.masteredCount ?? 0,
          againCount: item.againCount ?? 0
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

  if (existing) return existing;

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
  let learningStep = currentData.learningStep ?? 0;
  let lapses = currentData.lapses ?? 0;

  const totalReviews = currentData.totalReviews + 1;
  let knowItCount = currentData.knowItCount;
  let againCount = currentData.againCount;
  let masteredCount = currentData.masteredCount;

  let nextReviewMs: number;

  const isMatureReview = status === 'reviewing' || status === 'mastered';

  if (rating === 'again') {
    againCount++;
    easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
    if (isMatureReview) {
      // Mature card failed → reset to relearning
      lapses++;
    }
    status = 'learning';
    learningStep = 0;
    interval = 0;
    repetitions = 0;
    nextReviewMs = now + TEN_MINUTES_MS;

  } else if (rating === 'know_it') {
    knowItCount++;
    if (isMatureReview) {
      // Mature review card: grow interval using ease factor (conservative)
      interval = Math.max(1, Math.round(interval * easeFactor * 0.9));
      status = 'reviewing';
      learningStep = 0;
      repetitions++;
      nextReviewMs = now + interval * ONE_DAY_MS;
    } else {
      // New / learning card: advance through learning steps
      if (learningStep === 0) {
        // Step 0 → Step 1: schedule for 1 day
        learningStep = 1;
        interval = 1;
        status = 'learning';
        repetitions++;
        nextReviewMs = now + ONE_DAY_MS;
      } else {
        // Step 1 → graduate: schedule for 3 days
        learningStep = 0;
        interval = 3;
        status = 'reviewing';
        repetitions++;
        nextReviewMs = now + 3 * ONE_DAY_MS;
      }
    }

  } else {
    // 'mastered'
    masteredCount++;
    if (isMatureReview) {
      // Mature review card: aggressive interval growth
      interval = Math.max(1, Math.round(interval * easeFactor * 1.3));
      interval = Math.min(interval, 365); // cap at 1 year
      status = 'mastered';
      easeFactor = Math.min(3.0, easeFactor + 0.15);
      learningStep = 0;
      repetitions++;
      nextReviewMs = now + interval * ONE_DAY_MS;
    } else {
      // New / learning card: skip remaining learning steps and graduate
      const hasRepeatedlyFailed = lapses > 2;
      interval = hasRepeatedlyFailed ? 3 : 4;
      learningStep = 0;
      status = 'reviewing';
      easeFactor = Math.min(3.0, easeFactor + 0.1);
      repetitions++;
      nextReviewMs = now + interval * ONE_DAY_MS;
    }
  }

  return {
    ...currentData,
    easeFactor,
    interval,
    repetitions,
    nextReview: nextReviewMs,
    status,
    learningStep,
    lapses,
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

  if (currentUserId) {
    syncService.pushReview(updatedData, currentUserId);
  }

  return updatedData;
}

export function getDueCards(setId: string): CardReviewData[] {
  const now = Date.now();
  return getSetReviewData(setId).filter(card => card.nextReview <= now);
}

/**
 * Returns review records that are due right now (nextReview <= now).
 * Use this as the single source of truth for "due" state.
 */
export function getDueNowCardsForSet(setId: string): CardReviewData[] {
  const now = Date.now();
  return getSetReviewData(setId).filter(card => card.nextReview <= now);
}

/**
 * Builds the capped daily queue for a set, respecting DAILY_LIMITS.
 * Returns an ordered list of card IDs: learning due → review due → new cards.
 * This is the shared selector used by both the Home banner and the review queue.
 */
export function getDailyQueueCardIds(
  setId: string,
  allCardIds: string[],
  limits = DAILY_LIMITS
): string[] {
  const now = Date.now();
  const reviewData = getSetReviewData(setId);
  const reviewedIds = new Set(reviewData.map(d => d.cardId));

  // Bucket 1: learning/relearning cards due now
  const learningDue = reviewData
    .filter(d => d.status === 'learning' && d.nextReview <= now)
    .slice(0, limits.maxLearningPerDay)
    .map(d => d.cardId);

  // Bucket 2: mature review cards due now
  const reviewDue = reviewData
    .filter(d => (d.status === 'reviewing' || d.status === 'mastered') && d.nextReview <= now)
    .slice(0, limits.maxReviewPerDay)
    .map(d => d.cardId);

  // Bucket 3: new cards (never studied)
  const newCards = allCardIds
    .filter(id => !reviewedIds.has(id))
    .slice(0, limits.maxNewPerDay);

  // Combine and apply total cap
  const combined = [...learningDue, ...reviewDue, ...newCards];
  return combined.slice(0, limits.maxTotalPerDay);
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

  const totalAttempts = setData.reduce((sum, card) => sum + card.totalReviews, 0);
  const totalKnowIt = setData.reduce(
    (sum, card) => sum + card.knowItCount + card.masteredCount, 0
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
  return {
    setId,
    sessionId: crypto.randomUUID(),
    startTime: Date.now(),
    cardsReviewed: 0,
    cardsAgain: 0,
    cardsKnowIt: 0,
    cardsMastered: 0,
  };
}

export function endReviewSession(session: ReviewSession): ReviewSession {
  const endedSession = { ...session, endTime: Date.now() };

  try {
    const sessions = storageCache.get<ReviewSession[]>(STORAGE_KEY_SESSIONS) || [];
    sessions.push(endedSession);
    if (sessions.length > 100) sessions.shift();
    storageCache.set(STORAGE_KEY_SESSIONS, sessions);

    if (currentUserId && endedSession.endTime) {
      supabase.from('study_sessions').insert({
        user_id: currentUserId,
        deck_id: endedSession.setId,
        start_time: new Date(endedSession.startTime).toISOString(),
        end_time: new Date(endedSession.endTime).toISOString(),
        duration_seconds: Math.floor((endedSession.endTime - endedSession.startTime) / 1000),
        cards_studied: endedSession.cardsReviewed,
        cards_mastered: endedSession.cardsMastered
      }).then(({ error }: { error: { message: string } | null }) => {
        if (error) console.error('Error syncing session:', error);
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

export function getCardReview(cardId: string, setId: string): CardReviewData {
  return getCardReviewData(setId, cardId);
}

export function recordReview(
  cardId: string,
  setId: string,
  quality: 'again' | 'hard' | 'good' | 'easy'
): CardReviewData {
  const rating: ReviewRating =
    quality === 'again' ? 'again' :
    quality === 'hard' ? 'again' :
    quality === 'good' ? 'know_it' :
    'mastered';

  return saveCardReview(setId, cardId, rating);
}

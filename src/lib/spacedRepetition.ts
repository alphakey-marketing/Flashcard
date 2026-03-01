/**
 * Spaced Repetition System using SM-2 Algorithm
 * Based on SuperMemo 2 algorithm for optimal review scheduling
 * 
 * Key concepts:
 * - easeFactor: How easy the card is (higher = easier, longer intervals)
 * - interval: Days until next review
 * - repetitions: Number of consecutive correct reviews
 * - nextReview: Timestamp when card should be reviewed next
 */

export interface CardReviewData {
  cardId: string;
  setId: string;
  
  // SM-2 Algorithm data
  easeFactor: number;      // Default: 2.5, Range: 1.3-2.5+
  interval: number;        // Days until next review
  repetitions: number;     // Consecutive successful reviews
  nextReview: number;      // Timestamp (ms) for next review
  
  // Performance tracking
  totalReviews: number;    // Total number of times reviewed
  correctCount: number;    // Times marked as "Easy" or "Good"
  againCount: number;      // Times marked as "Again" (struggling)
  hardCount: number;       // Times marked as "Hard"
  
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
  cardsCorrect: number;
  cardsAgain: number;
  cardsHard: number;
  cardsEasy: number;
}

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy';

const STORAGE_KEY_REVIEWS = 'flashcard-review-data';
const STORAGE_KEY_SESSIONS = 'flashcard-review-sessions';

// SM-2 Algorithm Constants
const MIN_EASE_FACTOR = 1.3;
const DEFAULT_EASE_FACTOR = 2.5;
const INITIAL_INTERVAL = 1; // 1 day for first successful review

/**
 * Initialize review data for a new card
 */
export function initializeCardReview(setId: string, cardId: string): CardReviewData {
  const now = Date.now();
  return {
    cardId,
    setId,
    easeFactor: DEFAULT_EASE_FACTOR,
    interval: 0,
    repetitions: 0,
    nextReview: now, // Available for review immediately
    totalReviews: 0,
    correctCount: 0,
    againCount: 0,
    hardCount: 0,
    lastReviewed: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get all review data from storage
 */
function getReviewDataFromStorage(): CardReviewData[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_REVIEWS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error reading review data:', error);
    return [];
  }
}

/**
 * Save review data to storage
 */
function saveReviewDataToStorage(data: CardReviewData[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_REVIEWS, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving review data:', error);
  }
}

/**
 * Get review data for a specific card
 */
export function getCardReviewData(setId: string, cardId: string): CardReviewData {
  const allData = getReviewDataFromStorage();
  const existing = allData.find(d => d.setId === setId && d.cardId === cardId);
  
  if (existing) {
    return existing;
  }
  
  // Initialize if not found
  const newData = initializeCardReview(setId, cardId);
  allData.push(newData);
  saveReviewDataToStorage(allData);
  return newData;
}

/**
 * Get all review data for a set
 */
export function getSetReviewData(setId: string): CardReviewData[] {
  const allData = getReviewDataFromStorage();
  return allData.filter(d => d.setId === setId);
}

/**
 * Calculate next interval based on SM-2 algorithm
 * 
 * @param rating - User's rating of how well they knew the card
 * @param currentData - Current review data for the card
 * @returns Updated review data
 */
export function calculateNextReview(
  rating: ReviewRating,
  currentData: CardReviewData
): CardReviewData {
  const now = Date.now();
  let { easeFactor, interval, repetitions } = currentData;
  
  // Update performance counters
  const totalReviews = currentData.totalReviews + 1;
  let correctCount = currentData.correctCount;
  let againCount = currentData.againCount;
  let hardCount = currentData.hardCount;
  
  // Calculate quality of response (0-5 scale in SM-2)
  let quality: number;
  switch (rating) {
    case 'again':
      quality = 0; // Complete blackout
      againCount++;
      break;
    case 'hard':
      quality = 3; // Correct with difficulty
      hardCount++;
      break;
    case 'good':
      quality = 4; // Correct after hesitation
      correctCount++;
      break;
    case 'easy':
      quality = 5; // Perfect response
      correctCount++;
      break;
    default:
      quality = 0;
  }
  
  // SM-2 Algorithm
  if (quality >= 3) {
    // Correct response
    if (repetitions === 0) {
      interval = INITIAL_INTERVAL;
    } else if (repetitions === 1) {
      interval = 6; // 6 days
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  } else {
    // Incorrect response - reset
    repetitions = 0;
    interval = INITIAL_INTERVAL;
  }
  
  // Update ease factor based on performance
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  easeFactor = Math.max(
    MIN_EASE_FACTOR,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );
  
  // Calculate next review date
  const nextReview = now + (interval * 24 * 60 * 60 * 1000);
  
  return {
    ...currentData,
    easeFactor,
    interval,
    repetitions,
    nextReview,
    totalReviews,
    correctCount,
    againCount,
    hardCount,
    lastReviewed: now,
    updatedAt: now,
  };
}

/**
 * Save updated review data after a review
 */
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
  return updatedData;
}

/**
 * Get cards that are due for review
 */
export function getDueCards(setId: string): CardReviewData[] {
  const now = Date.now();
  const setData = getSetReviewData(setId);
  return setData.filter(card => card.nextReview <= now);
}

/**
 * Get cards that need more practice (high "again" count)
 */
export function getDifficultCards(
  setId: string,
  threshold: number = 3
): CardReviewData[] {
  const setData = getSetReviewData(setId);
  return setData
    .filter(card => card.againCount >= threshold)
    .sort((a, b) => b.againCount - a.againCount);
}

/**
 * Get mastered cards (high ease factor and successful repetitions)
 */
export function getMasteredCards(
  setId: string,
  minRepetitions: number = 5
): CardReviewData[] {
  const setData = getSetReviewData(setId);
  return setData.filter(
    card => card.repetitions >= minRepetitions && card.easeFactor >= 2.5
  );
}

/**
 * Calculate study statistics for a set
 */
export function getSetStudyStats(setId: string, totalCards: number) {
  const setData = getSetReviewData(setId);
  const now = Date.now();
  
  const dueCards = setData.filter(card => card.nextReview <= now);
  const masteredCards = getMasteredCards(setId);
  const difficultCards = getDifficultCards(setId);
  
  const totalReviews = setData.reduce((sum, card) => sum + card.totalReviews, 0);
  const averageEaseFactor = setData.length > 0
    ? setData.reduce((sum, card) => sum + card.easeFactor, 0) / setData.length
    : DEFAULT_EASE_FACTOR;
  
  // Calculate success rate
  const totalAttempts = setData.reduce(
    (sum, card) => sum + card.totalReviews,
    0
  );
  const totalCorrect = setData.reduce(
    (sum, card) => sum + card.correctCount,
    0
  );
  const successRate = totalAttempts > 0 ? (totalCorrect / totalAttempts) * 100 : 0;
  
  return {
    totalCards,
    studiedCards: setData.length,
    newCards: totalCards - setData.length,
    dueCards: dueCards.length,
    masteredCards: masteredCards.length,
    difficultCards: difficultCards.length,
    totalReviews,
    averageEaseFactor: Math.round(averageEaseFactor * 100) / 100,
    successRate: Math.round(successRate * 100) / 100,
  };
}

/**
 * Start a new review session
 */
export function startReviewSession(setId: string): ReviewSession {
  const session: ReviewSession = {
    setId,
    sessionId: crypto.randomUUID(),
    startTime: Date.now(),
    cardsReviewed: 0,
    cardsCorrect: 0,
    cardsAgain: 0,
    cardsHard: 0,
    cardsEasy: 0,
  };
  
  return session;
}

/**
 * End a review session and save it
 */
export function endReviewSession(session: ReviewSession): ReviewSession {
  const endedSession = {
    ...session,
    endTime: Date.now(),
  };
  
  // Save to storage
  try {
    const sessions = JSON.parse(
      localStorage.getItem(STORAGE_KEY_SESSIONS) || '[]'
    );
    sessions.push(endedSession);
    // Keep only last 100 sessions
    if (sessions.length > 100) {
      sessions.shift();
    }
    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sessions));
  } catch (error) {
    console.error('Error saving session:', error);
  }
  
  return endedSession;
}

/**
 * Get review sessions for a set
 */
export function getRecentSessions(
  setId: string,
  limit: number = 10
): ReviewSession[] {
  try {
    const sessions: ReviewSession[] = JSON.parse(
      localStorage.getItem(STORAGE_KEY_SESSIONS) || '[]'
    );
    return sessions
      .filter(s => s.setId === setId)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  } catch (error) {
    console.error('Error loading sessions:', error);
    return [];
  }
}

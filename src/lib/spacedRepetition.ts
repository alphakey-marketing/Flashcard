/**
 * Spaced Repetition System using SM-2 Algorithm
 * Modified to use 3-button system: Again / Know It / Mastered
 * 
 * Key concepts:
 * - easeFactor: How easy the card is (higher = easier, longer intervals)
 * - interval: Days until next review
 * - repetitions: Number of consecutive correct reviews
 * - nextReview: Timestamp when card should be reviewed next
 * - status: learning / reviewing / mastered
 */

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

/**
 * Get all review data from storage
 */
function getReviewDataFromStorage(): CardReviewData[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_REVIEWS);
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    // Migrate old data if needed
    return parsed.map((item: any) => {
      if (!item.status) {
        // Migrate old 4-button data to new 3-button system
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
 * Calculate next interval based on 3-button system
 * 
 * Again: Reset progress, short interval (1 day)
 * Know It: Normal progress, medium intervals (2-5 days)
 * Mastered: Graduate card, long intervals (7+ days)
 * 
 * @param rating - User's rating (again / know_it / mastered)
 * @param currentData - Current review data for the card
 * @returns Updated review data
 */
export function calculateNextReview(
  rating: ReviewRating,
  currentData: CardReviewData
): CardReviewData {
  const now = Date.now();
  let { easeFactor, interval, repetitions, status } = currentData;
  
  // Update performance counters
  const totalReviews = currentData.totalReviews + 1;
  let knowItCount = currentData.knowItCount;
  let againCount = currentData.againCount;
  let masteredCount = currentData.masteredCount;
  
  // Process rating
  switch (rating) {
    case 'again':
      // Reset progress - card goes back to learning
      againCount++;
      repetitions = 0;
      interval = 1; // 1 day
      status = 'learning';
      // Decrease ease factor (make it harder)
      easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor - 0.2);
      break;
      
    case 'know_it':
      // Normal progress - card stays in reviewing
      knowItCount++;
      
      if (repetitions === 0) {
        interval = 2; // 2 days
        status = 'reviewing';
      } else if (repetitions === 1) {
        interval = 4; // 4 days
        status = 'reviewing';
      } else {
        interval = Math.round(interval * 1.5); // Gradual increase
        status = 'reviewing';
      }
      
      repetitions++;
      // Maintain ease factor
      break;
      
    case 'mastered':
      // Graduate card - long intervals
      masteredCount++;
      
      if (repetitions === 0) {
        interval = 7; // 1 week
      } else {
        interval = Math.round(interval * easeFactor); // Use full ease factor
      }
      
      repetitions++;
      status = 'mastered';
      // Increase ease factor (make it easier)
      easeFactor = Math.min(3.0, easeFactor + 0.15);
      break;
  }
  
  // Calculate next review date
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
 * Get cards that are due for review (includes learning and reviewing cards)
 */
export function getDueCards(setId: string): CardReviewData[] {
  const now = Date.now();
  const setData = getSetReviewData(setId);
  return setData.filter(card => 
    card.nextReview <= now || 
    card.status === 'learning' || 
    card.status === 'reviewing'
  );
}

/**
 * Get cards in learning state (not yet mastered)
 */
export function getLearningCards(setId: string): CardReviewData[] {
  const setData = getSetReviewData(setId);
  return setData.filter(card => card.status === 'learning' || card.status === 'reviewing');
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
 * Get mastered cards (status = 'mastered')
 */
export function getMasteredCards(setId: string): CardReviewData[] {
  const setData = getSetReviewData(setId);
  return setData.filter(card => card.status === 'mastered');
}

/**
 * Calculate study statistics for a set
 */
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
  
  // Calculate success rate
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

/**
 * Start a new review session
 */
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

// Spaced repetition algorithm implementation

export interface CardReview {
  cardId: string;
  quality: number; // 0-5 rating
  timestamp: number;
}

export interface CardData {
  cardId: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewDate: number;
}

const DEFAULT_EASE_FACTOR = 2.5;
const MIN_EASE_FACTOR = 1.3;

/**
 * Calculate next review interval based on SM-2 algorithm
 * @param quality - User's performance rating (0-5)
 * @param cardData - Current card statistics
 * @returns Updated card data with next review date
 */
export function calculateNextReview(
  quality: number,
  cardData: CardData
): CardData {
  let { easeFactor, interval, repetitions } = cardData;

  // Update ease factor
  easeFactor = Math.max(
    MIN_EASE_FACTOR,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  // Calculate next interval
  if (quality < 3) {
    // Reset on poor performance
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * easeFactor);
    }
    repetitions++;
  }

  const nextReviewDate = Date.now() + interval * 24 * 60 * 60 * 1000;

  return {
    ...cardData,
    easeFactor,
    interval,
    repetitions,
    nextReviewDate,
  };
}

/**
 * Initialize new card data
 */
export function initializeCard(cardId: string): CardData {
  return {
    cardId,
    easeFactor: DEFAULT_EASE_FACTOR,
    interval: 0,
    repetitions: 0,
    nextReviewDate: Date.now(),
  };
}

/**
 * Get cards due for review
 */
export function getDueCards(cards: CardData[]): CardData[] {
  const now = Date.now();
  return cards.filter((card) => card.nextReviewDate <= now);
}

/**
 * Sort cards by priority (most overdue first)
 */
export function sortCardsByPriority(cards: CardData[]): CardData[] {
  return [...cards].sort((a, b) => a.nextReviewDate - b.nextReviewDate);
}

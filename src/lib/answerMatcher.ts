/**
 * 3-Tier Flexible Answer Matching System for Learn Mode
 * 
 * Tier 1: Exact match - Full answer must match exactly (case-insensitive)
 * Tier 2: Part match - Splits by delimiters (commas, slashes, semicolons) and matches any part
 * Tier 3: Word-level match - Matches meaningful words, filtering out stop words
 */

export interface MatchResult {
  isCorrect: boolean;
  matchType: 'exact' | 'part' | 'word' | 'none';
  confidence: number; // 1.0 for exact, 0.8 for part, 0.6 for word, 0.0 for none
}

// Common English stop words to filter out in word-level matching
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'by', 'for',
  'with', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'should', 'could', 'may', 'might', 'must', 'can', 'shall', 'or', 'and',
  'but', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'which',
  'who', 'whom', 'whose', 'what', 'that', 'this', 'these', 'those'
]);

/**
 * Normalize text for comparison
 * - Convert to lowercase
 * - Trim whitespace
 * - Remove punctuation (but keep hyphens in words)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[.,!?;:"'()\[\]{}]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Split text by delimiters (comma, slash, semicolon)
 */
function splitByDelimiters(text: string): string[] {
  return text
    .split(/[,;\/]/)
    .map(part => part.trim())
    .filter(part => part.length > 0);
}

/**
 * Extract meaningful words (filter out stop words)
 */
function extractMeaningfulWords(text: string): string[] {
  return text
    .split(/\s+/)
    .map(word => word.toLowerCase().trim())
    .filter(word => word.length > 0 && !STOP_WORDS.has(word));
}

/**
 * Check if user answer matches correct answer using 3-tier system
 * Returns detailed match result with confidence level
 */
export function checkAnswerWithDetails(
  userAnswer: string,
  correctAnswer: string
): MatchResult {
  if (!userAnswer || !correctAnswer) {
    return { isCorrect: false, matchType: 'none', confidence: 0.0 };
  }

  const normalizedUser = normalizeText(userAnswer);
  const normalizedCorrect = normalizeText(correctAnswer);

  // Tier 1: Exact match
  if (normalizedUser === normalizedCorrect) {
    return { isCorrect: true, matchType: 'exact', confidence: 1.0 };
  }

  // Tier 2: Part match (split by delimiters)
  const correctParts = splitByDelimiters(normalizedCorrect);
  if (correctParts.length > 1) {
    // Check if user answer matches any of the parts exactly
    for (const part of correctParts) {
      if (normalizeText(part) === normalizedUser) {
        return { isCorrect: true, matchType: 'part', confidence: 0.8 };
      }
    }
  }

  // Tier 3: Word-level match
  const correctWords = extractMeaningfulWords(normalizedCorrect);
  const userWords = extractMeaningfulWords(normalizedUser);

  // Check if user answer contains at least one meaningful word from correct answer
  // or if a correct word is contained within a user word (partial matching)
  const hasMatchingWord = userWords.some(userWord =>
    correctWords.some(correctWord => {
      // Check for substring matches in both directions
      return (
        userWord.includes(correctWord) ||
        correctWord.includes(userWord) ||
        userWord === correctWord
      );
    })
  );

  if (hasMatchingWord && userWords.length > 0) {
    return { isCorrect: true, matchType: 'word', confidence: 0.6 };
  }

  return { isCorrect: false, matchType: 'none', confidence: 0.0 };
}

/**
 * Simple boolean check for backwards compatibility
 * Uses the 3-tier matching system internally
 */
export function checkAnswer(
  userAnswer: string,
  correctAnswer: string
): boolean {
  return checkAnswerWithDetails(userAnswer, correctAnswer).isCorrect;
}

/**
 * Get a human-readable description of the match type
 */
export function getMatchTypeDescription(matchType: MatchResult['matchType']): string {
  switch (matchType) {
    case 'exact':
      return 'Perfect match!';
    case 'part':
      return 'Partial match (accepted one valid answer)';
    case 'word':
      return 'Key word match (accepted)';
    case 'none':
      return 'No match';
    default:
      return '';
  }
}

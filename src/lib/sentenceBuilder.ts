// Sentence Builder Utility
// Manages sentence creation challenges and user submissions

import { getSetReviewData } from './spacedRepetition';
import { Card } from './storage';

export interface SentenceChallenge {
  challengeId: string;
  setId: string;
  words: Card[];
  prompt: string;
  createdAt: number;
  userAnswer?: string;
  score?: number;
  feedback?: string[];
}

export interface DailyPrompt {
  date: string; // YYYY-MM-DD format
  setId: string;
  words: Card[];
  prompt: string;
  userEntry?: string;
  completedAt?: number;
}

const SENTENCE_CHALLENGES_KEY = 'sentence-challenges';
const DAILY_PROMPTS_KEY = 'daily-prompts';

// Generate a new sentence building challenge
export function generateChallenge(setId: string, cards: Card[]): SentenceChallenge | null {
  // Get mastered cards from review data using correct status check
  const reviewData = getSetReviewData(setId);
  const masteredCardIds = reviewData
    .filter(r => r.status === 'mastered') // ✅ CORRECT CHECK
    .map(r => r.cardId);

  const masteredCards = cards.filter(c => masteredCardIds.includes(c.id));

  if (masteredCards.length < 3) {
    return null; // Need at least 3 mastered cards
  }

  // Randomly select 3-5 words
  const wordCount = Math.min(5, Math.max(3, Math.floor(Math.random() * 3) + 3));
  const selectedWords = masteredCards
    .sort(() => Math.random() - 0.5)
    .slice(0, wordCount);

  // Generate creative prompts
  const prompts = [
    'これらの単語を使って文章を作ってください。',
    '次の単語で文を書いてください。',
    'これらの言葉を使って何か書いてください。',
    '全ての単語を使った文章を作りましょう。'
  ];

  const challenge: SentenceChallenge = {
    challengeId: `${setId}_${Date.now()}`,
    setId,
    words: selectedWords,
    prompt: prompts[Math.floor(Math.random() * prompts.length)],
    createdAt: Date.now()
  };

  return challenge;
}

// Submit answer for a challenge and get feedback
export function submitChallengeAnswer(
  challengeId: string,
  setId: string,
  userAnswer: string
): { score: number; feedback: string[]; isCorrect: boolean } {
  try {
    // Get the challenge from history or use the current one
    const history = getChallengeHistory(setId);
    const existingChallenge = history.find(c => c.challengeId === challengeId);

    if (!existingChallenge) {
      return {
        score: 0,
        feedback: ['Challenge not found'],
        isCorrect: false
      };
    }

    // Validate the sentence
    const validation = validateSentence(userAnswer, existingChallenge.words);

    // Save to history
    const completedChallenge: SentenceChallenge = {
      ...existingChallenge,
      userAnswer,
      score: validation.score,
      feedback: [validation.feedback]
    };

    saveChallengeToHistory(completedChallenge);

    return {
      score: validation.score,
      feedback: [validation.feedback],
      isCorrect: validation.isValid
    };
  } catch (error) {
    console.error('Error submitting challenge answer:', error);
    return {
      score: 0,
      feedback: ['Error processing answer'],
      isCorrect: false
    };
  }
}

// Save challenge to history
function saveChallengeToHistory(challenge: SentenceChallenge): void {
  try {
    const history = getChallengeHistory(challenge.setId, 100);
    const existingIndex = history.findIndex(c => c.challengeId === challenge.challengeId);

    if (existingIndex >= 0) {
      history[existingIndex] = challenge;
    } else {
      history.unshift(challenge);
    }

    // Keep only last 50
    const recentHistory = history.slice(0, 50);

    const allHistory = getAllChallengeHistory();
    allHistory[challenge.setId] = recentHistory;

    localStorage.setItem(SENTENCE_CHALLENGES_KEY, JSON.stringify(allHistory));
  } catch (error) {
    console.error('Error saving challenge history:', error);
  }
}

// Get all challenge history (all sets)
function getAllChallengeHistory(): { [setId: string]: SentenceChallenge[] } {
  try {
    const data = localStorage.getItem(SENTENCE_CHALLENGES_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading challenge history:', error);
    return {};
  }
}

// Get challenge history for a specific set
export function getChallengeHistory(setId: string, limit: number = 10): SentenceChallenge[] {
  try {
    const allHistory = getAllChallengeHistory();
    const setHistory = allHistory[setId] || [];
    return setHistory
      .filter(c => c.userAnswer) // Only completed challenges
      .slice(0, limit);
  } catch (error) {
    console.error('Error loading challenge history:', error);
    return [];
  }
}

// Simple validation rules for Japanese sentences
export function validateSentence(sentence: string, requiredWords: Card[]): {
  isValid: boolean;
  feedback: string;
  score: number;
} {
  if (!sentence || sentence.trim().length === 0) {
    return {
      isValid: false,
      feedback: '文章を入力してください。(Please enter a sentence)',
      score: 0
    };
  }

  const trimmedSentence = sentence.trim();
  const issues: string[] = [];
  let score = 100;

  // Check if sentence uses all required words
  const missingWords: string[] = [];
  for (const word of requiredWords) {
    const wordText = word.front.split('[')[0].trim(); // Extract kanji/kana before bracket
    const wordReading = word.front.match(/\[(.*?)\]/)?.[1]; // Extract reading
    
    const hasWord = trimmedSentence.includes(wordText) || 
                    (wordReading && trimmedSentence.includes(wordReading));
    
    if (!hasWord) {
      missingWords.push(wordText);
    }
  }

  if (missingWords.length > 0) {
    issues.push(`使用されていない単語: ${missingWords.join(', ')}`);
    score -= missingWords.length * 25;
  }

  // Check basic sentence structure
  if (trimmedSentence.length < 5) {
    issues.push('文章が短すぎます。');
    score -= 20;
  }

  if (trimmedSentence.length > 100) {
    issues.push('文章が長すぎます。');
    score -= 10;
  }

  // Check for ending punctuation
  const lastChar = trimmedSentence[trimmedSentence.length - 1];
  if (lastChar !== '。' && lastChar !== '？' && lastChar !== '！' && lastChar !== '.' && lastChar !== '?' && lastChar !== '!') {
    issues.push('句点（。）で終わってください。');
    score -= 10;
  }

  // Positive feedback if well-formed
  const isValid = issues.length === 0;
  let feedback = '';

  if (isValid) {
    feedback = '✅ Great sentence! All words used correctly.';
  } else {
    feedback = issues.join(' ');
  }

  return {
    isValid,
    feedback,
    score: Math.max(0, score)
  };
}

// Daily Writing Prompt Functions
export function getTodayPrompt(setId: string, cards: Card[]): DailyPrompt | null {
  const today = new Date().toISOString().split('T')[0];
  const prompts = getDailyPrompts();
  
  // Check if today's prompt already exists
  let todayPrompt = prompts.find(p => p.date === today && p.setId === setId);
  
  if (!todayPrompt) {
    // Generate new prompt for today
    todayPrompt = generateDailyPrompt(setId, cards, today);
    if (todayPrompt) {
      saveDailyPrompt(todayPrompt);
    }
  }
  
  return todayPrompt || null;
}

function generateDailyPrompt(setId: string, cards: Card[], date: string): DailyPrompt | null {
  // Get mastered cards using correct status check
  const reviewData = getSetReviewData(setId);
  const masteredCardIds = reviewData
    .filter(r => r.status === 'mastered') // ✅ CORRECT CHECK
    .map(r => r.cardId);

  const masteredCards = cards.filter(c => masteredCardIds.includes(c.id));

  if (masteredCards.length < 3) {
    return null;
  }

  // Select 3-5 words
  const wordCount = Math.min(5, Math.max(3, Math.floor(Math.random() * 3) + 3));
  const selectedWords = masteredCards
    .sort(() => Math.random() - 0.5)
    .slice(0, wordCount);

  // Generate prompt based on day
  const prompts = [
    '今日の出来事について書いてください。',
    'あなたの一日について書いてください。',
    '今日何をしましたか？',
    '今日の気持ちを書いてください。',
    '今週の出来事について書いてください。'
  ];

  const prompt = prompts[Math.floor(Math.random() * prompts.length)];

  return {
    date,
    setId,
    words: selectedWords,
    prompt
  };
}

export function saveDailyPrompt(prompt: DailyPrompt): void {
  try {
    const prompts = getDailyPrompts();
    const existingIndex = prompts.findIndex(p => p.date === prompt.date && p.setId === prompt.setId);
    
    if (existingIndex >= 0) {
      prompts[existingIndex] = prompt;
    } else {
      prompts.push(prompt);
    }

    // Keep only last 90 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffString = cutoffDate.toISOString().split('T')[0];
    
    const recentPrompts = prompts.filter(p => p.date >= cutoffString);

    localStorage.setItem(DAILY_PROMPTS_KEY, JSON.stringify(recentPrompts));
  } catch (error) {
    console.error('Error saving daily prompt:', error);
  }
}

export function getDailyPrompts(): DailyPrompt[] {
  try {
    const data = localStorage.getItem(DAILY_PROMPTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading daily prompts:', error);
    return [];
  }
}

export function completeDailyPrompt(date: string, setId: string, userEntry: string): void {
  try {
    const prompts = getDailyPrompts();
    const prompt = prompts.find(p => p.date === date && p.setId === setId);
    
    if (prompt) {
      prompt.userEntry = userEntry;
      prompt.completedAt = Date.now();
      saveDailyPrompt(prompt);
    }
  } catch (error) {
    console.error('Error completing daily prompt:', error);
  }
}

export function getPromptHistory(setId: string, limit: number = 30): DailyPrompt[] {
  const prompts = getDailyPrompts();
  return prompts
    .filter(p => p.setId === setId && p.completedAt)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function getPromptStreak(setId: string): number {
  const prompts = getDailyPrompts()
    .filter(p => p.setId === setId && p.completedAt)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (prompts.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  
  for (let i = 0; i < prompts.length; i++) {
    const promptDate = new Date(prompts[i].date);
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);
    
    if (promptDate.toISOString().split('T')[0] === expectedDate.toISOString().split('T')[0]) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

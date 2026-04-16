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
const CURRENT_CHALLENGE_KEY = 'current-challenge';
const CURRENT_PROMPT_KEY = 'current-daily-prompt';

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

  // Save as current challenge and to history
  saveCurrentChallenge(setId, challenge);
  saveToHistory(challenge);

  return challenge;
}

// Save the current active challenge for a set
function saveCurrentChallenge(setId: string, challenge: SentenceChallenge): void {
  try {
    const currentChallenges = getAllCurrentChallenges();
    currentChallenges[setId] = challenge;
    localStorage.setItem(CURRENT_CHALLENGE_KEY, JSON.stringify(currentChallenges));
  } catch (error) {
    console.error('Error saving current challenge:', error);
  }
}

// Get all current challenges
function getAllCurrentChallenges(): { [setId: string]: SentenceChallenge } {
  try {
    const data = localStorage.getItem(CURRENT_CHALLENGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading current challenges:', error);
    return {};
  }
}

// Get current active challenge for a set
export function getCurrentChallenge(setId: string): SentenceChallenge | null {
  try {
    const currentChallenges = getAllCurrentChallenges();
    return currentChallenges[setId] || null;
  } catch (error) {
    console.error('Error getting current challenge:', error);
    return null;
  }
}

// Clear current challenge for a set
export function clearCurrentChallenge(setId: string): void {
  try {
    const currentChallenges = getAllCurrentChallenges();
    delete currentChallenges[setId];
    localStorage.setItem(CURRENT_CHALLENGE_KEY, JSON.stringify(currentChallenges));
  } catch (error) {
    console.error('Error clearing current challenge:', error);
  }
}

// Save the current active daily prompt for a set
function saveCurrentDailyPrompt(setId: string, prompt: DailyPrompt): void {
  try {
    const currentPrompts = getAllCurrentDailyPrompts();
    currentPrompts[setId] = prompt;
    localStorage.setItem(CURRENT_PROMPT_KEY, JSON.stringify(currentPrompts));
  } catch (error) {
    console.error('Error saving current daily prompt:', error);
  }
}

// Get all current daily prompts
function getAllCurrentDailyPrompts(): { [setId: string]: DailyPrompt } {
  try {
    const data = localStorage.getItem(CURRENT_PROMPT_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('Error loading current daily prompts:', error);
    return {};
  }
}

// Get current active daily prompt for a set
export function getCurrentDailyPrompt(setId: string): DailyPrompt | null {
  try {
    const currentPrompts = getAllCurrentDailyPrompts();
    return currentPrompts[setId] || null;
  } catch (error) {
    console.error('Error getting current daily prompt:', error);
    return null;
  }
}

// Clear current daily prompt for a set
export function clearCurrentDailyPrompt(setId: string): void {
  try {
    const currentPrompts = getAllCurrentDailyPrompts();
    delete currentPrompts[setId];
    localStorage.setItem(CURRENT_PROMPT_KEY, JSON.stringify(currentPrompts));
  } catch (error) {
    console.error('Error clearing current daily prompt:', error);
  }
}

// Save challenge to history (without limit)
function saveToHistory(challenge: SentenceChallenge): void {
  try {
    const allHistory = getAllChallengeHistory();
    const setHistory = allHistory[challenge.setId] || [];
    
    // Check if challenge already exists
    const existingIndex = setHistory.findIndex(c => c.challengeId === challenge.challengeId);
    
    if (existingIndex >= 0) {
      setHistory[existingIndex] = challenge;
    } else {
      setHistory.unshift(challenge);
    }
    
    allHistory[challenge.setId] = setHistory;
    localStorage.setItem(SENTENCE_CHALLENGES_KEY, JSON.stringify(allHistory));
  } catch (error) {
    console.error('Error saving to history:', error);
  }
}

// Submit answer for a challenge and get feedback
export function submitChallengeAnswer(
  challengeId: string,
  setId: string,
  userAnswer: string
): { score: number; feedback: string[]; isCorrect: boolean } {
  try {
    // Get the challenge from history
    const allHistory = getAllChallengeHistory();
    const setHistory = allHistory[setId] || [];
    const existingChallenge = setHistory.find(c => c.challengeId === challengeId);

    if (!existingChallenge) {
      console.error('Challenge not found:', challengeId);
      console.log('Available challenges:', setHistory.map(c => c.challengeId));
      return {
        score: 0,
        feedback: ['Challenge not found. Please try generating a new challenge.'],
        isCorrect: false
      };
    }

    // Validate the sentence
    const validation = validateSentence(userAnswer, existingChallenge.words);

    // Save to history with answer and score
    const completedChallenge: SentenceChallenge = {
      ...existingChallenge,
      userAnswer,
      score: validation.score,
      feedback: [validation.feedback]
    };

    saveToHistory(completedChallenge);
    
    // Clear current challenge since it's now completed
    clearCurrentChallenge(setId);

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

// Get challenge history for a specific set (all completed ones, no limit)
export function getChallengeHistory(setId: string, limit?: number): SentenceChallenge[] {
  try {
    const allHistory = getAllChallengeHistory();
    const setHistory = allHistory[setId] || [];
    const completed = setHistory.filter(c => c.userAnswer); // Only completed challenges
    
    if (limit) {
      return completed.slice(0, limit);
    }
    return completed;
  } catch (error) {
    console.error('Error loading challenge history:', error);
    return [];
  }
}

// Delete a specific challenge from history
export function deleteChallenge(setId: string, challengeId: string): boolean {
  try {
    const allHistory = getAllChallengeHistory();
    const setHistory = allHistory[setId] || [];
    
    const filteredHistory = setHistory.filter(c => c.challengeId !== challengeId);
    
    if (filteredHistory.length === setHistory.length) {
      return false; // Challenge not found
    }
    
    allHistory[setId] = filteredHistory;
    localStorage.setItem(SENTENCE_CHALLENGES_KEY, JSON.stringify(allHistory));
    return true;
  } catch (error) {
    console.error('Error deleting challenge:', error);
    return false;
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

// Tokenize a sentence into an array of lowercase words
export function tokenizeSentence(sentence: string): string[] {
  return sentence
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 0);
}

// Daily Writing Prompt Functions
export function getTodayPrompt(setId: string, cards: Card[]): DailyPrompt | null {
  const today = new Date().toISOString().split('T')[0];
  const prompts = getDailyPrompts();
  
  // Check if today's prompt already exists
  let todayPrompt: DailyPrompt | null | undefined = prompts.find(p => p.date === today && p.setId === setId);
  
  if (!todayPrompt) {
    // Generate new prompt for today
    todayPrompt = generateDailyPrompt(setId, cards, today);
    if (todayPrompt) {
      saveDailyPrompt(todayPrompt);
      saveCurrentDailyPrompt(setId, todayPrompt);
    }
  } else if (!todayPrompt.completedAt) {
    // Save as current if not completed
    saveCurrentDailyPrompt(setId, todayPrompt);
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

    // Keep all prompts (no limit)
    localStorage.setItem(DAILY_PROMPTS_KEY, JSON.stringify(prompts));
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
      clearCurrentDailyPrompt(setId);
    }
  } catch (error) {
    console.error('Error completing daily prompt:', error);
  }
}

// Update an existing daily prompt entry
export function updateDailyPrompt(date: string, setId: string, userEntry: string): void {
  try {
    const prompts = getDailyPrompts();
    const prompt = prompts.find(p => p.date === date && p.setId === setId);
    
    if (prompt) {
      prompt.userEntry = userEntry;
      prompt.completedAt = Date.now();
      saveDailyPrompt(prompt);
    }
  } catch (error) {
    console.error('Error updating daily prompt:', error);
  }
}

export function getPromptHistory(setId: string, limit?: number): DailyPrompt[] {
  const prompts = getDailyPrompts();
  const filtered = prompts
    .filter(p => p.setId === setId && p.completedAt)
    .sort((a, b) => b.date.localeCompare(a.date));
  
  if (limit) {
    return filtered.slice(0, limit);
  }
  return filtered;
}

// Delete a specific daily prompt
export function deleteDailyPrompt(setId: string, date: string): boolean {
  try {
    const prompts = getDailyPrompts();
    const filteredPrompts = prompts.filter(p => !(p.setId === setId && p.date === date));
    
    if (filteredPrompts.length === prompts.length) {
      return false; // Prompt not found
    }
    
    localStorage.setItem(DAILY_PROMPTS_KEY, JSON.stringify(filteredPrompts));
    return true;
  } catch (error) {
    console.error('Error deleting daily prompt:', error);
    return false;
  }
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

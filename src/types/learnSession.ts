import { Flashcard } from '../lib/storage';

export type QuestionType = 'multiple-choice' | 'type-in' | 'matching' | 'flashcard';

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface LearnQuestion {
  id: string;
  card: Flashcard;
  type: QuestionType;
  prompt: string;
  correctAnswer: string;
  options?: QuestionOption[]; // For multiple choice
  userAnswer?: string;
  isCorrect?: boolean;
  attempts: number;
}

export interface MatchingPair {
  id: string;
  front: string;
  back: string;
  matched: boolean;
}

export interface LearnSessionProgress {
  totalQuestions: number;
  completedQuestions: number;
  correctCount: number;
  incorrectCount: number;
}

export interface LearnSessionResult {
  totalCards: number;
  correctAnswers: number;
  accuracy: number;
  duration: number; // in seconds
  completedAt: Date;
}

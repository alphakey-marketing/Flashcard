/**
 * Study statistics and session tracking
 */

import { storageCache } from './storageCache';

export interface StudySession {
  setId: string;
  setTitle: string;
  startTime: number;
  endTime?: number;
  cardsStudied: number;
  cardsMastered: number;
  duration: number; // in seconds
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  sessions: StudySession[];
  totalCards: number;
  totalDuration: number; // in seconds
}

export interface StudyStreak {
  current: number;
  longest: number;
  lastStudyDate: string; // YYYY-MM-DD
}

const SESSIONS_KEY = 'flashmind-study-sessions';
const STREAK_KEY = 'flashmind-study-streak';
const CACHE_TTL = 3000; // 3 seconds cache for study data

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get all study sessions from storage (with caching)
 */
function getAllSessions(): StudySession[] {
  try {
    const data = storageCache.get<StudySession[]>(SESSIONS_KEY, CACHE_TTL);
    return data || [];
  } catch (error) {
    console.error('Error reading study sessions:', error);
    return [];
  }
}

/**
 * Save study sessions to storage (invalidates cache)
 */
function saveSessions(sessions: StudySession[]): void {
  try {
    storageCache.set(SESSIONS_KEY, sessions);
  } catch (error) {
    console.error('Error saving study sessions:', error);
  }
}

/**
 * Record a completed study session
 */
export function recordSession(session: StudySession): void {
  const sessions = getAllSessions();
  sessions.push({
    ...session,
    endTime: session.endTime || Date.now()
  });
  saveSessions(sessions);
  updateStreak();
}

/**
 * Get study sessions for a specific date
 */
export function getSessionsForDate(date: string): StudySession[] {
  const sessions = getAllSessions();
  return sessions.filter(session => {
    const sessionDate = new Date(session.startTime).toISOString().split('T')[0];
    return sessionDate === date;
  });
}

/**
 * Get daily statistics for a specific date
 */
export function getDailyStats(date: string): DailyStats {
  const sessions = getSessionsForDate(date);
  return {
    date,
    sessions,
    totalCards: sessions.reduce((sum, s) => sum + s.cardsStudied, 0),
    totalDuration: sessions.reduce((sum, s) => sum + s.duration, 0)
  };
}

/**
 * Get today's statistics
 */
export function getTodayStats(): DailyStats {
  return getDailyStats(getTodayDate());
}

/**
 * Get statistics for the last N days
 */
export function getRecentStats(days: number = 7): DailyStats[] {
  const stats: DailyStats[] = [];
  const today = new Date();

  for (let i = 0; i < days; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    stats.push(getDailyStats(dateStr));
  }

  return stats.reverse();
}

/**
 * Get current study streak (with caching)
 */
export function getStreak(): StudyStreak {
  try {
    const data = storageCache.get<StudyStreak>(STREAK_KEY, CACHE_TTL);
    return data || { current: 0, longest: 0, lastStudyDate: '' };
  } catch (error) {
    console.error('Error reading streak:', error);
    return { current: 0, longest: 0, lastStudyDate: '' };
  }
}

/**
 * Update study streak after a session
 */
function updateStreak(): void {
  const today = getTodayDate();
  const streak = getStreak();

  if (streak.lastStudyDate === today) {
    // Already studied today, no change
    return;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  if (streak.lastStudyDate === yesterdayStr) {
    // Continued streak
    streak.current += 1;
  } else if (streak.lastStudyDate === '') {
    // First time studying
    streak.current = 1;
  } else {
    // Streak broken, start over
    streak.current = 1;
  }

  // Update longest streak
  if (streak.current > streak.longest) {
    streak.longest = streak.current;
  }

  streak.lastStudyDate = today;

  try {
    storageCache.set(STREAK_KEY, streak);
  } catch (error) {
    console.error('Error saving streak:', error);
  }
}

/**
 * Calculate total study time (all time)
 */
export function getTotalStudyTime(): number {
  const sessions = getAllSessions();
  return sessions.reduce((sum, s) => sum + s.duration, 0);
}

/**
 * Calculate total cards studied (all time)
 */
export function getTotalCardsStudied(): number {
  const sessions = getAllSessions();
  return sessions.reduce((sum, s) => sum + s.cardsStudied, 0);
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
}

/**
 * Study streak tracking and statistics
 */

interface StudySession {
  date: string; // YYYY-MM-DD format
  cardsStudied: number;
  setsCompleted: string[]; // set IDs
  durationMinutes: number;
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalDaysStudied: number;
  lastStudyDate: string; // YYYY-MM-DD
  sessions: StudySession[];
}

const STREAK_STORAGE_KEY = 'flashmind-streaks';

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayString(): string {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
function getYesterdayString(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Load streak data from localStorage
 */
function loadStreakData(): StreakData {
  try {
    const data = localStorage.getItem(STREAK_STORAGE_KEY);
    if (!data) {
      return {
        currentStreak: 0,
        longestStreak: 0,
        totalDaysStudied: 0,
        lastStudyDate: '',
        sessions: []
      };
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading streak data:', error);
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalDaysStudied: 0,
      lastStudyDate: '',
      sessions: []
    };
  }
}

/**
 * Save streak data to localStorage
 */
function saveStreakData(data: StreakData): void {
  try {
    localStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Error saving streak data:', error);
  }
}

/**
 * Record a study session
 */
export function recordStudySession(
  setId: string,
  cardsStudied: number,
  durationMinutes: number = 0
): void {
  const data = loadStreakData();
  const today = getTodayString();
  const yesterday = getYesterdayString();

  // Find or create today's session
  let todaySession = data.sessions.find(s => s.date === today);
  
  if (!todaySession) {
    todaySession = {
      date: today,
      cardsStudied: 0,
      setsCompleted: [],
      durationMinutes: 0
    };
    data.sessions.push(todaySession);
  }

  // Update session
  todaySession.cardsStudied += cardsStudied;
  todaySession.durationMinutes += durationMinutes;
  if (!todaySession.setsCompleted.includes(setId)) {
    todaySession.setsCompleted.push(setId);
  }

  // Update streak logic
  if (data.lastStudyDate === today) {
    // Already studied today, streak unchanged
  } else if (data.lastStudyDate === yesterday || data.lastStudyDate === '') {
    // Continue streak or start new
    data.currentStreak += 1;
    data.lastStudyDate = today;
  } else {
    // Streak broken, start over
    data.currentStreak = 1;
    data.lastStudyDate = today;
  }

  // Update longest streak
  if (data.currentStreak > data.longestStreak) {
    data.longestStreak = data.currentStreak;
  }

  // Count unique study days
  const uniqueDays = new Set(data.sessions.map(s => s.date));
  data.totalDaysStudied = uniqueDays.size;

  saveStreakData(data);
}

/**
 * Get current streak data
 */
export function getStreakData(): StreakData {
  const data = loadStreakData();
  const today = getTodayString();
  const yesterday = getYesterdayString();

  // Check if streak is still valid
  if (data.lastStudyDate !== today && data.lastStudyDate !== yesterday && data.lastStudyDate !== '') {
    // Streak broken
    data.currentStreak = 0;
  }

  return data;
}

/**
 * Get today's study stats
 */
export function getTodayStats(): { cardsStudied: number; setsCompleted: number; durationMinutes: number } {
  const data = loadStreakData();
  const today = getTodayString();
  const todaySession = data.sessions.find(s => s.date === today);

  if (!todaySession) {
    return { cardsStudied: 0, setsCompleted: 0, durationMinutes: 0 };
  }

  return {
    cardsStudied: todaySession.cardsStudied,
    setsCompleted: todaySession.setsCompleted.length,
    durationMinutes: todaySession.durationMinutes
  };
}

/**
 * Get study calendar (last 30 days)
 */
export function getStudyCalendar(days: number = 30): { date: string; cardsStudied: number }[] {
  const data = loadStreakData();
  const calendar: { date: string; cardsStudied: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    
    const session = data.sessions.find(s => s.date === dateString);
    calendar.push({
      date: dateString,
      cardsStudied: session ? session.cardsStudied : 0
    });
  }

  return calendar;
}

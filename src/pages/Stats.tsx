import React, { useState, useEffect, CSSProperties } from 'react';
import { getStreak, getTodayStats, getRecentStats, formatDuration, getTotalCardsStudied, getTotalStudyTime } from '../lib/studyStats';

interface StatsProps {
  onNavigateToHome: () => void;
}

const Stats: React.FC<StatsProps> = ({ onNavigateToHome }) => {
  const [streak, setStreak] = useState({ current: 0, longest: 0, lastStudyDate: '' });
  const [todayStats, setTodayStats] = useState({ totalCards: 0, totalDuration: 0, sessions: [] });
  const [weekStats, setWeekStats] = useState<any[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [totalTime, setTotalTime] = useState(0);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = () => {
    setStreak(getStreak());
    setTodayStats(getTodayStats());
    setWeekStats(getRecentStats(7));
    setTotalCards(getTotalCardsStudied());
    setTotalTime(getTotalStudyTime());
  };

  const getWeekdayName = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button
          style={styles.backButton}
          onClick={onNavigateToHome}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          ←
        </button>
        <h1 style={styles.title}>Study Statistics</h1>
        <div style={{ width: '40px' }} />
      </header>

      <div style={styles.content}>
        {/* Streak Section */}
        <div style={styles.streakSection}>
          <div style={styles.streakCard}>
            <div style={styles.streakIcon}>🔥</div>
            <div style={styles.streakInfo}>
              <div style={styles.streakValue}>{streak.current}</div>
              <div style={styles.streakLabel}>Day Streak</div>
            </div>
          </div>
          <div style={styles.streakCard}>
            <div style={styles.streakIcon}>🏆</div>
            <div style={styles.streakInfo}>
              <div style={styles.streakValue}>{streak.longest}</div>
              <div style={styles.streakLabel}>Longest Streak</div>
            </div>
          </div>
        </div>

        {/* Today's Stats */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📅 Today</h2>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{todayStats.totalCards}</div>
              <div style={styles.statLabel}>Cards Studied</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{todayStats.sessions.length}</div>
              <div style={styles.statLabel}>Sessions</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{formatDuration(todayStats.totalDuration)}</div>
              <div style={styles.statLabel}>Time Spent</div>
            </div>
          </div>
        </div>

        {/* Weekly Activity */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>📈 Last 7 Days</h2>
          <div style={styles.weekGrid}>
            {weekStats.map((day) => (
              <div
                key={day.date}
                style={{
                  ...styles.dayCard,
                  backgroundColor: day.totalCards > 0 ? '#dcfce7' : '#f1f5f9',
                  border: isToday(day.date) ? '2px solid #3b82f6' : '1px solid #e2e8f0'
                }}
              >
                <div style={styles.dayName}>{getWeekdayName(day.date)}</div>
                <div style={{
                  ...styles.dayValue,
                  color: day.totalCards > 0 ? '#16a34a' : '#94a3b8'
                }}>
                  {day.totalCards > 0 ? day.totalCards : '-'}
                </div>
                <div style={styles.dayLabel}>cards</div>
              </div>
            ))}
          </div>
        </div>

        {/* All-Time Stats */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>♻️ All Time</h2>
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{totalCards}</div>
              <div style={styles.statLabel}>Total Cards</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{formatDuration(totalTime)}</div>
              <div style={styles.statLabel}>Total Time</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>
                {totalTime > 0 ? Math.round(totalTime / 60 / (streak.longest || 1)) : 0}m
              </div>
              <div style={styles.statLabel}>Avg per Day</div>
            </div>
          </div>
        </div>

        {/* Motivation */}
        {streak.current === 0 && (
          <div style={styles.motivationBox}>
            <div style={styles.motivationIcon}>💪</div>
            <p style={styles.motivationText}>
              Start studying today to begin your streak!
            </p>
          </div>
        )}

        {streak.current >= 7 && (
          <div style={{ ...styles.motivationBox, backgroundColor: '#fef3c7' }}>
            <div style={styles.motivationIcon}>⭐</div>
            <p style={styles.motivationText}>
              Amazing! You've been studying for {streak.current} days straight!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc'
  },
  header: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  backButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#64748b',
    padding: '4px 8px',
    transition: 'opacity 0.2s',
    width: '40px'
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
    flex: 1,
    textAlign: 'center'
  },
  content: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '24px'
  },
  streakSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
  },
  streakCard: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    border: '1px solid #e2e8f0'
  },
  streakIcon: {
    fontSize: '48px'
  },
  streakInfo: {
    flex: 1
  },
  streakValue: {
    fontSize: '36px',
    fontWeight: 700,
    color: '#f97316',
    lineHeight: '1'
  },
  streakLabel: {
    fontSize: '14px',
    color: '#64748b',
    marginTop: '4px'
  },
  section: {
    marginBottom: '32px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '16px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '16px'
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    border: '1px solid #e2e8f0'
  },
  statValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#3b82f6',
    marginBottom: '4px'
  },
  statLabel: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: 500
  },
  weekGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '8px'
  },
  dayCard: {
    borderRadius: '12px',
    padding: '12px 8px',
    textAlign: 'center',
    transition: 'transform 0.2s'
  },
  dayName: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#64748b',
    marginBottom: '4px'
  },
  dayValue: {
    fontSize: '20px',
    fontWeight: 700,
    marginBottom: '2px'
  },
  dayLabel: {
    fontSize: '10px',
    color: '#94a3b8'
  },
  motivationBox: {
    backgroundColor: '#dbeafe',
    borderRadius: '12px',
    padding: '20px',
    textAlign: 'center',
    marginTop: '24px'
  },
  motivationIcon: {
    fontSize: '32px',
    marginBottom: '8px'
  },
  motivationText: {
    fontSize: '14px',
    color: '#1e40af',
    margin: 0,
    fontWeight: 500
  }
};

export default Stats;

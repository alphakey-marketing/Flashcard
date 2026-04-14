import React, { CSSProperties } from 'react';
import { LearnSessionResult } from '../types/learnSession';

interface LearnCompleteProps {
  result: LearnSessionResult;
  deckTitle: string;
  onContinue: () => void;
  onExit: () => void;
}

const LearnComplete: React.FC<LearnCompleteProps> = ({ result, deckTitle, onContinue, onExit }) => {
  const minutes = Math.floor(result.duration / 60);
  const seconds = result.duration % 60;

  const getPerformanceMessage = (accuracy: number) => {
    if (accuracy >= 90) return { emoji: '🎉', message: 'Outstanding!', color: '#10b981' };
    if (accuracy >= 75) return { emoji: '🌟', message: 'Great job!', color: '#3b82f6' };
    if (accuracy >= 60) return { emoji: '👍', message: 'Good work!', color: '#f59e0b' };
    return { emoji: '💪', message: 'Keep practicing!', color: '#ef4444' };
  };

  const performance = getPerformanceMessage(result.accuracy);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Success Icon */}
        <div style={styles.iconContainer}>
          <div style={{ ...styles.icon, color: performance.color }}>
            {performance.emoji}
          </div>
        </div>

        {/* Title */}
        <h1 style={{ ...styles.title, color: performance.color }}>
          {performance.message}
        </h1>
        <p style={styles.subtitle}>You completed "{deckTitle}"</p>

        {/* Stats Grid */}
        <div style={styles.statsGrid}>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{result.totalCards}</div>
            <div style={styles.statLabel}>Cards Studied</div>
          </div>
          <div style={styles.statBox}>
            <div style={{ ...styles.statValue, color: '#10b981' }}>
              {result.correctAnswers}
            </div>
            <div style={styles.statLabel}>Correct</div>
          </div>
          <div style={styles.statBox}>
            <div style={{ ...styles.statValue, color: performance.color }}>
              {result.accuracy}%
            </div>
            <div style={styles.statLabel}>Accuracy</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statValue}>
              {minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`}
            </div>
            <div style={styles.statLabel}>Time</div>
          </div>
        </div>

        {/* Progress Message */}
        <div style={styles.messageBox}>
          <div style={styles.messageIcon}>🎯</div>
          <div style={styles.messageText}>
            {result.accuracy >= 80
              ? 'Excellent! These cards will appear less frequently in your reviews.'
              : result.accuracy >= 60
              ? 'Good progress! Keep reviewing to master these cards.'
              : 'Don\'t worry! These cards will appear more often to help you learn.'}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={styles.buttonContainer}>
          <button
            style={styles.continueButton}
            onClick={onContinue}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            🔄 Study Again
          </button>
          <button
            style={styles.exitButton}
            onClick={onExit}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            ← Back to Home
          </button>
        </div>

        {/* Tips */}
        <div style={styles.tipBox}>
          <strong>💡 Pro Tip:</strong> Come back tomorrow to review due cards and strengthen your memory!
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '48px',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
    textAlign: 'center'
  },
  iconContainer: {
    marginBottom: '24px'
  },
  icon: {
    fontSize: '80px',
    animation: 'bounce 1s ease-in-out'
  },
  title: {
    fontSize: '36px',
    fontWeight: 700,
    margin: '0 0 8px 0'
  },
  subtitle: {
    fontSize: '18px',
    color: '#64748b',
    marginBottom: '32px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
    marginBottom: '32px'
  },
  statBox: {
    backgroundColor: '#f8fafc',
    borderRadius: '16px',
    padding: '24px',
    border: '2px solid #e2e8f0'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#3b82f6',
    marginBottom: '8px'
  },
  statLabel: {
    fontSize: '14px',
    color: '#64748b',
    fontWeight: 500
  },
  messageBox: {
    backgroundColor: '#eff6ff',
    border: '2px solid #3b82f6',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '32px',
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
    textAlign: 'left'
  },
  messageIcon: {
    fontSize: '24px',
    flexShrink: 0
  },
  messageText: {
    fontSize: '14px',
    color: '#1e40af',
    lineHeight: '1.5'
  },
  buttonContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px'
  },
  continueButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 32px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  exitButton: {
    backgroundColor: '#fff',
    color: '#64748b',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px 32px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  tipBox: {
    backgroundColor: '#fef3c7',
    border: '2px solid #fbbf24',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '14px',
    color: '#92400e',
    textAlign: 'left'
  }
};

export default LearnComplete;

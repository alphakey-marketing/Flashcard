import React, { useState, useEffect, CSSProperties } from 'react';
import { getSet, updateKnownCards, FlashcardSet } from '../lib/storage';

interface SwipeProps {
  setId: string;
  onNavigateToHome: () => void;
}

const Swipe: React.FC<SwipeProps> = ({ setId, onNavigateToHome }) => {
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownIds, setKnownIds] = useState<Set<string>>(new Set());
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const flashcardSet = getSet(setId);
    if (flashcardSet) {
      setSet(flashcardSet);
      setKnownIds(new Set(flashcardSet.knownCardIds));
    } else {
      onNavigateToHome();
    }
  }, [setId, onNavigateToHome]);

  if (!set) {
    return (
      <div style={styles.container}>
        <p style={styles.loading}>Loading...</p>
      </div>
    );
  }

  const currentCard = set.cards[currentIndex];
  const progress = ((currentIndex + (isFinished ? 1 : 0)) / set.cards.length) * 100;

  const handleNext = (known: boolean) => {
    const newKnownIds = new Set(knownIds);
    if (known) {
      newKnownIds.add(currentCard.id);
    } else {
      newKnownIds.delete(currentCard.id);
    }
    setKnownIds(newKnownIds);

    if (currentIndex < set.cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      setIsFinished(true);
      updateKnownCards(set.id, Array.from(newKnownIds));
    }
  };

  const handleStudyAgain = () => {
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsFinished(false);
  };

  if (isFinished) {
    const knownCount = knownIds.size;
    const totalCount = set.cards.length;
    const percentage = Math.round((knownCount / totalCount) * 100);

    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <button
            style={styles.closeButton}
            onClick={onNavigateToHome}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            ✕
          </button>
          <h2 style={styles.headerTitle}>{set.title}</h2>
          <div style={{ width: '40px' }} />
        </header>

        <div style={styles.finishedContainer}>
          <div style={styles.finishedIcon}>🎉</div>
          <h1 style={styles.finishedTitle}>Great Job!</h1>
          <p style={styles.finishedText}>You've completed this set</p>
          
          <div style={styles.statsContainer}>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{knownCount}</div>
              <div style={styles.statLabel}>Known</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{totalCount - knownCount}</div>
              <div style={styles.statLabel}>Review</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{percentage}%</div>
              <div style={styles.statLabel}>Mastery</div>
            </div>
          </div>

          <div style={styles.finishedButtons}>
            <button
              style={styles.studyAgainButton}
              onClick={handleStudyAgain}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              Study Again
            </button>
            <button
              style={styles.homeButton}
              onClick={onNavigateToHome}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#fff')}
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button
          style={styles.closeButton}
          onClick={onNavigateToHome}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          ✕
        </button>
        <h2 style={styles.headerTitle}>{set.title}</h2>
        <span style={styles.counter}>
          {currentIndex + 1} / {set.cards.length}
        </span>
      </header>

      <div style={styles.progressBarContainer}>
        <div style={{ ...styles.progressBar, width: `${progress}%` }} />
      </div>

      <div style={styles.cardContainer}>
        <div
          style={styles.flashcard}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          <div style={styles.cardContent}>
            {!isFlipped ? (
              <>
                <div style={styles.cardLabel}>FRONT</div>
                <div style={styles.cardText}>{currentCard.front}</div>
                <div style={styles.tapHint}>Tap to flip</div>
              </>
            ) : (
              <>
                <div style={styles.cardLabel}>BACK</div>
                <div style={styles.cardText}>{currentCard.back}</div>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={styles.actions}>
        <button
          style={styles.againButton}
          onClick={() => handleNext(false)}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span style={styles.buttonIcon}>✕</span>
          <span>Again</span>
        </button>
        <button
          style={styles.gotItButton}
          onClick={() => handleNext(true)}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <span style={styles.buttonIcon}>✓</span>
          <span>Got It</span>
        </button>
      </div>
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#64748b',
    padding: '4px 8px',
    transition: 'opacity 0.2s',
    width: '40px'
  },
  headerTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
    flex: 1,
    textAlign: 'center'
  },
  counter: {
    fontSize: '14px',
    color: '#64748b',
    fontWeight: 500,
    width: '40px',
    textAlign: 'right'
  },
  progressBarContainer: {
    height: '4px',
    backgroundColor: '#e2e8f0',
    width: '100%'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    transition: 'width 0.3s'
  },
  cardContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px'
  },
  flashcard: {
    width: '100%',
    maxWidth: '600px',
    minHeight: '400px',
    backgroundColor: '#fff',
    borderRadius: '24px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px',
    transition: 'transform 0.2s',
    border: '2px solid #e2e8f0'
  },
  cardContent: {
    textAlign: 'center',
    width: '100%'
  },
  cardLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '1px',
    marginBottom: '24px'
  },
  cardText: {
    fontSize: '28px',
    fontWeight: 600,
    color: '#0f172a',
    lineHeight: '1.4',
    wordWrap: 'break-word'
  },
  tapHint: {
    fontSize: '14px',
    color: '#94a3b8',
    marginTop: '24px'
  },
  actions: {
    display: 'flex',
    gap: '16px',
    padding: '24px',
    maxWidth: '600px',
    margin: '0 auto',
    width: '100%'
  },
  againButton: {
    flex: 1,
    backgroundColor: '#fff',
    color: '#ef4444',
    border: '2px solid #ef4444',
    borderRadius: '16px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'transform 0.2s'
  },
  gotItButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    color: 'white',
    border: 'none',
    borderRadius: '16px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'transform 0.2s'
  },
  buttonIcon: {
    fontSize: '20px'
  },
  finishedContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px'
  },
  finishedIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  finishedTitle: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '8px'
  },
  finishedText: {
    fontSize: '16px',
    color: '#64748b',
    marginBottom: '32px'
  },
  statsContainer: {
    display: 'flex',
    gap: '24px',
    marginBottom: '32px'
  },
  statBox: {
    textAlign: 'center'
  },
  statValue: {
    fontSize: '36px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '4px'
  },
  statLabel: {
    fontSize: '14px',
    color: '#64748b',
    fontWeight: 500
  },
  finishedButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    maxWidth: '300px'
  },
  studyAgainButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '14px 32px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  homeButton: {
    backgroundColor: '#fff',
    color: '#0f172a',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px 32px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  loading: {
    textAlign: 'center',
    marginTop: '48px',
    fontSize: '18px',
    color: '#64748b'
  }
};

export default Swipe;

import React, { useState, useEffect, CSSProperties, useCallback } from 'react';
import { getSet, updateKnownCards, FlashcardSet, Card } from '../lib/storage';

interface SwipeProps {
  setId: string;
  onNavigateToHome: () => void;
}

const Swipe: React.FC<SwipeProps> = ({ setId, onNavigateToHome }) => {
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [activeQueue, setActiveQueue] = useState<Card[]>([]);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [knownIds, setKnownIds] = useState<Set<string>>(new Set());
  const [totalCards, setTotalCards] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    const flashcardSet = getSet(setId);
    if (flashcardSet) {
      setSet(flashcardSet);
      setKnownIds(new Set(flashcardSet.knownCardIds));
      setActiveQueue([...flashcardSet.cards]);
      setCurrentCard(flashcardSet.cards[0] || null);
      setTotalCards(flashcardSet.cards.length);
    } else {
      onNavigateToHome();
    }
  }, [setId, onNavigateToHome]);

  const handleGotIt = useCallback(() => {
    if (!currentCard || !set) return;

    // Mark card as known
    const newKnownIds = new Set(knownIds);
    newKnownIds.add(currentCard.id);
    setKnownIds(newKnownIds);

    // Remove from queue
    const newQueue = activeQueue.slice(1);

    if (newQueue.length === 0) {
      // All cards mastered!
      setIsFinished(true);
      updateKnownCards(set.id, Array.from(newKnownIds));
    } else {
      // Move to next card
      setActiveQueue(newQueue);
      setCurrentCard(newQueue[0]);
      setIsFlipped(false);
    }
  }, [currentCard, set, knownIds, activeQueue]);

  const handleAgain = useCallback(() => {
    if (!currentCard) return;

    // Mark card as not known
    const newKnownIds = new Set(knownIds);
    newKnownIds.delete(currentCard.id);
    setKnownIds(newKnownIds);

    const newQueue = [...activeQueue];
    const missedCard = newQueue.shift()!; // Remove from front

    if (newQueue.length === 0) {
      // Last card - put it right back
      newQueue.push(missedCard);
    } else {
      // Insert randomly into remaining cards (not at the front)
      const randomIndex = Math.floor(Math.random() * newQueue.length) + 1;
      newQueue.splice(randomIndex, 0, missedCard);
    }

    setActiveQueue(newQueue);
    setCurrentCard(newQueue[0]);
    setIsFlipped(false);
  }, [currentCard, knownIds, activeQueue]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isFinished) return;

      // Prevent shortcuts when typing in input fields (though shouldn't be any here, good practice)
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ': // Spacebar
          e.preventDefault();
          setIsFlipped(prev => !prev);
          break;
        case '1':
        case 'ArrowLeft':
          e.preventDefault();
          if (isFlipped) handleAgain();
          break;
        case '2':
        case 'ArrowRight':
          e.preventDefault();
          if (isFlipped) handleGotIt();
          break;
        case 'Escape':
          e.preventDefault();
          onNavigateToHome();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, isFinished, handleAgain, handleGotIt, onNavigateToHome]);

  const handleStudyAgain = () => {
    if (!set) return;
    setActiveQueue([...set.cards]);
    setCurrentCard(set.cards[0]);
    setIsFlipped(false);
    setIsFinished(false);
    setKnownIds(new Set());
  };

  if (!set || !currentCard) {
    return (
      <div style={styles.container}>
        <p style={styles.loading}>Loading...</p>
      </div>
    );
  }

  const cardsCompleted = totalCards - activeQueue.length;
  const progress = (cardsCompleted / totalCards) * 100;

  if (isFinished) {
    const knownCount = knownIds.size;
    const percentage = Math.round((knownCount / totalCards) * 100);

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
          <h1 style={styles.finishedTitle}>完璧！Perfect!</h1>
          <p style={styles.finishedText}>You've mastered all cards in this set!</p>
          
          <div style={styles.statsContainer}>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{totalCards}</div>
              <div style={styles.statLabel}>Cards</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{knownCount}</div>
              <div style={styles.statLabel}>Mastered</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{percentage}%</div>
              <div style={styles.statLabel}>Complete</div>
            </div>
          </div>

          <div style={styles.finishedButtons}>
            <button
              style={styles.studyAgainButton}
              onClick={handleStudyAgain}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              もう一度 Study Again
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
          title="ESC to exit"
        >
          ✕
        </button>
        <h2 style={styles.headerTitle}>{set.title}</h2>
        <span style={styles.counter}>
          {activeQueue.length} left
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
                <div style={styles.tapHint}>👆 Tap to flip (or press Space)</div>
              </>
            ) : (
              <>
                <div style={styles.cardLabel}>BACK</div>
                <div style={styles.cardText}>{currentCard.back}</div>
              </>
            )}
          </div>
        </div>

        <div style={styles.queueInfo}>
          💡 Cards remaining: {activeQueue.length} / {totalCards}
        </div>

        <div style={styles.keyboardHints}>
          <span style={styles.hint}><kbd style={styles.kbd}>Space</kbd> Flip</span>
          <span style={styles.hint}><kbd style={styles.kbd}>1</kbd> or <kbd style={styles.kbd}>←</kbd> Again</span>
          <span style={styles.hint}><kbd style={styles.kbd}>2</kbd> or <kbd style={styles.kbd}>→</kbd> Got It</span>
          <span style={styles.hint}><kbd style={styles.kbd}>ESC</kbd> Home</span>
        </div>
      </div>

      <div style={styles.actions}>
        <button
          style={{
            ...styles.againButton,
            opacity: !isFlipped ? 0.5 : 1,
            cursor: !isFlipped ? 'not-allowed' : 'pointer',
          }}
          onClick={() => {
            if (isFlipped) handleAgain();
          }}
          onMouseEnter={(e) => {
            if (isFlipped) e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            if (isFlipped) e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span style={styles.buttonIcon}>✕</span>
          <span>もう一度<br/>Again</span>
          <span style={styles.buttonShortcut}>1 or ←</span>
        </button>
        <button
          style={{
            ...styles.gotItButton,
            opacity: !isFlipped ? 0.5 : 1,
            cursor: !isFlipped ? 'not-allowed' : 'pointer',
          }}
          onClick={() => {
            if (isFlipped) handleGotIt();
          }}
          onMouseEnter={(e) => {
            if (isFlipped) e.currentTarget.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            if (isFlipped) e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          <span style={styles.buttonIcon}>✓</span>
          <span>覚えた<br/>Got It</span>
          <span style={styles.buttonShortcut}>2 or →</span>
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
    fontSize: '16px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
    flex: 1,
    textAlign: 'center'
  },
  counter: {
    fontSize: '14px',
    color: '#3b82f6',
    fontWeight: 600,
    width: '80px',
    textAlign: 'right'
  },
  progressBarContainer: {
    height: '4px',
    backgroundColor: '#e2e8f0',
    width: '100%'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#22c55e',
    transition: 'width 0.3s'
  },
  cardContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    gap: '16px'
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
    border: '2px solid #e2e8f0',
    userSelect: 'none' // Prevent text selection when double clicking
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
    fontSize: '32px',
    fontWeight: 600,
    color: '#0f172a',
    lineHeight: '1.5',
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap'
  },
  tapHint: {
    fontSize: '14px',
    color: '#94a3b8',
    marginTop: '24px'
  },
  queueInfo: {
    fontSize: '14px',
    color: '#64748b',
    textAlign: 'center',
    padding: '8px 16px',
    backgroundColor: '#fff',
    borderRadius: '20px',
    border: '1px solid #e2e8f0'
  },
  keyboardHints: {
    display: 'flex',
    gap: '16px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    fontSize: '12px',
    color: '#94a3b8'
  },
  hint: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  kbd: {
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    padding: '2px 6px',
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#475569'
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
    padding: '20px',
    fontSize: '16px',
    fontWeight: 600,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    lineHeight: '1.3'
  },
  gotItButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    color: 'white',
    border: 'none',
    borderRadius: '16px',
    padding: '20px',
    fontSize: '16px',
    fontWeight: 600,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s',
    lineHeight: '1.3'
  },
  buttonIcon: {
    fontSize: '24px'
  },
  buttonShortcut: {
    fontSize: '11px',
    opacity: 0.8,
    fontWeight: 400
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
    color: '#22c55e',
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

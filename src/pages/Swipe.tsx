import React, { useState, useEffect, CSSProperties, useCallback } from 'react';
import { getSet, FlashcardSet, Card } from '../lib/storage';
import { audioService } from '../lib/audioService';
import { recordSession } from '../lib/studyStats';
import { saveCardReview, ReviewRating, getDueCards } from '../lib/spacedRepetition';

interface SwipeProps {
  setId: string;
  onNavigateToHome: () => void;
}

const Swipe: React.FC<SwipeProps> = ({ setId, onNavigateToHome }) => {
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [activeQueue, setActiveQueue] = useState<Card[]>([]);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0 });
  const [totalCards, setTotalCards] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [sessionStartTime] = useState(Date.now());

  useEffect(() => {
    const flashcardSet = getSet(setId);
    if (flashcardSet) {
      setSet(flashcardSet);
      
      // We could filter by getDueCards, but for now we'll review all or just due ones.
      // Let's mix due cards first, then new cards.
      // For simplicity, let's load all cards but we'll apply the SRS algorithm to reviews.
      const dueCardsData = getDueCards(setId);
      const dueCardIds = new Set(dueCardsData.map(d => d.cardId));
      
      // Sort so due cards come first
      const sortedCards = [...flashcardSet.cards].sort((a, b) => {
        const aDue = dueCardIds.has(a.id) ? -1 : 1;
        const bDue = dueCardIds.has(b.id) ? -1 : 1;
        return aDue - bDue;
      });

      setActiveQueue(sortedCards);
      setCurrentCard(sortedCards[0] || null);
      setTotalCards(sortedCards.length);
    } else {
      onNavigateToHome();
    }
  }, [setId, onNavigateToHome]);

  // Auto-play audio when card is flipped
  useEffect(() => {
    if (isFlipped && audioEnabled && currentCard) {
      // Extract Japanese text from the front (before any special characters)
      const japaneseText = currentCard.front.split(/[\n,]|\s-\s/)[0].trim();
      if (japaneseText) {
        // Small delay to feel more natural
        setTimeout(() => {
          audioService.speak(japaneseText);
        }, 200);
      }
    }
  }, [isFlipped, audioEnabled, currentCard]);

  const handleReview = useCallback((rating: ReviewRating) => {
    if (!currentCard || !set) return;

    // Save review to SM-2 system
    saveCardReview(set.id, currentCard.id, rating);
    
    // Update session stats
    setSessionStats(prev => ({
      reviewed: prev.reviewed + 1,
      correct: rating !== 'again' ? prev.correct + 1 : prev.correct
    }));

    const newQueue = [...activeQueue];
    const reviewedCard = newQueue.shift()!; // Remove from front

    if (rating === 'again') {
      // If they forgot it, put it back in the queue
      if (newQueue.length === 0) {
        newQueue.push(reviewedCard);
      } else {
        // Insert a few cards down, or at the end if few cards left
        const insertIndex = Math.min(newQueue.length, 3);
        newQueue.splice(insertIndex, 0, reviewedCard);
      }
    }

    if (newQueue.length === 0) {
      // All done!
      setIsFinished(true);
      
      const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
      // We still record to basic study stats
      recordSession({
        setId: set.id,
        setTitle: set.title,
        startTime: sessionStartTime,
        endTime: Date.now(),
        cardsStudied: totalCards,
        cardsMastered: sessionStats.correct + (rating !== 'again' ? 1 : 0),
        duration
      });
    } else {
      setActiveQueue(newQueue);
      setCurrentCard(newQueue[0]);
      setIsFlipped(false);
    }
  }, [currentCard, set, activeQueue, sessionStartTime, totalCards, sessionStats]);

  const handlePlayAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentCard) {
      const japaneseText = currentCard.front.split(/[\n,]|\s-\s/)[0].trim();
      audioService.speak(japaneseText);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isFinished) return;

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ': // Spacebar
          e.preventDefault();
          setIsFlipped(prev => !prev);
          break;
        case '1':
          e.preventDefault();
          if (isFlipped) handleReview('again');
          break;
        case '2':
          e.preventDefault();
          if (isFlipped) handleReview('hard');
          break;
        case '3':
          e.preventDefault();
          if (isFlipped) handleReview('good');
          break;
        case '4':
          e.preventDefault();
          if (isFlipped) handleReview('easy');
          break;
        case 'a':
        case 'A':
          e.preventDefault();
          if (isFlipped) handlePlayAudio(e as any);
          break;
        case 'Escape':
          e.preventDefault();
          onNavigateToHome();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, isFinished, handleReview, onNavigateToHome]);

  const handleStudyAgain = () => {
    if (!set) return;
    setActiveQueue([...set.cards]);
    setCurrentCard(set.cards[0]);
    setIsFlipped(false);
    setIsFinished(false);
    setSessionStats({ reviewed: 0, correct: 0 });
  };

  if (!set || !currentCard) {
    return (
      <div style={styles.container}>
        <p style={styles.loading}>Loading...</p>
      </div>
    );
  }

  const cardsCompleted = totalCards - activeQueue.filter(c => !activeQueue.slice(activeQueue.indexOf(c) + 1).includes(c)).length;
  // Approximation of progress
  const progress = Math.min(100, Math.max(0, (cardsCompleted / totalCards) * 100));

  if (isFinished) {
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
    const minutesStudied = Math.floor(duration / 60);
    const secondsStudied = duration % 60;
    const accuracy = sessionStats.reviewed > 0 
      ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) 
      : 100;

    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <button style={styles.closeButton} onClick={onNavigateToHome}>✕</button>
          <h2 style={styles.headerTitle}>{set.title}</h2>
          <div style={{ width: '40px' }} />
        </header>

        <div style={styles.finishedContainer}>
          <div style={styles.finishedIcon}>🎉</div>
          <h1 style={styles.finishedTitle}>Session Complete!</h1>
          <p style={styles.finishedText}>Great job reviewing these cards.</p>
          
          <div style={styles.statsContainer}>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{totalCards}</div>
              <div style={styles.statLabel}>Cards</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{sessionStats.reviewed}</div>
              <div style={styles.statLabel}>Reviews</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{accuracy}%</div>
              <div style={styles.statLabel}>Accuracy</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>
                {minutesStudied > 0 ? `${minutesStudied}m ` : ''}{secondsStudied}s
              </div>
              <div style={styles.statLabel}>Time</div>
            </div>
          </div>

          <div style={styles.finishedButtons}>
            <button style={styles.studyAgainButton} onClick={handleStudyAgain}>
              Review Again
            </button>
            <button style={styles.homeButton} onClick={onNavigateToHome}>
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
        <button style={styles.closeButton} onClick={onNavigateToHome} title="ESC to exit">✕</button>
        <h2 style={styles.headerTitle}>{set.title}</h2>
        <div style={styles.audioToggle}>
          <button
            style={{ ...styles.audioButton, opacity: audioEnabled ? 1 : 0.4 }}
            onClick={() => setAudioEnabled(!audioEnabled)}
            title={audioEnabled ? 'Audio ON' : 'Audio OFF'}
          >
            {audioEnabled ? '🔊' : '🔇'}
          </button>
          <span style={styles.counter}>{activeQueue.length} left</span>
        </div>
      </header>

      <div style={styles.progressBarContainer}>
        <div style={{ ...styles.progressBar, width: `${progress}%` }} />
      </div>

      <div style={styles.cardContainer}>
        <div style={styles.flashcard} onClick={() => setIsFlipped(!isFlipped)}>
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
                {audioService.isSupported() && (
                  <button style={styles.speakerButton} onClick={handlePlayAudio} title="Play audio (A)">
                    🔊 Listen
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        <div style={styles.queueInfo}>
          💡 Cards remaining: {activeQueue.length}
        </div>

        <div style={styles.keyboardHints}>
          <span style={styles.hint}><kbd style={styles.kbd}>Space</kbd> Flip</span>
          <span style={styles.hint}><kbd style={styles.kbd}>1</kbd> Again</span>
          <span style={styles.hint}><kbd style={styles.kbd}>2</kbd> Hard</span>
          <span style={styles.hint}><kbd style={styles.kbd}>3</kbd> Good</span>
          <span style={styles.hint}><kbd style={styles.kbd}>4</kbd> Easy</span>
          <span style={styles.hint}><kbd style={styles.kbd}>A</kbd> Audio</span>
        </div>
      </div>

      <div style={styles.actions}>
        <button
          style={{ ...styles.reviewBtn, ...styles.btnAgain, opacity: !isFlipped ? 0.5 : 1 }}
          onClick={() => { if (isFlipped) handleReview('again'); }}
          disabled={!isFlipped}
        >
          <span>Again</span>
          <span style={styles.buttonShortcut}>1</span>
        </button>
        <button
          style={{ ...styles.reviewBtn, ...styles.btnHard, opacity: !isFlipped ? 0.5 : 1 }}
          onClick={() => { if (isFlipped) handleReview('hard'); }}
          disabled={!isFlipped}
        >
          <span>Hard</span>
          <span style={styles.buttonShortcut}>2</span>
        </button>
        <button
          style={{ ...styles.reviewBtn, ...styles.btnGood, opacity: !isFlipped ? 0.5 : 1 }}
          onClick={() => { if (isFlipped) handleReview('good'); }}
          disabled={!isFlipped}
        >
          <span>Good</span>
          <span style={styles.buttonShortcut}>3</span>
        </button>
        <button
          style={{ ...styles.reviewBtn, ...styles.btnEasy, opacity: !isFlipped ? 0.5 : 1 }}
          onClick={() => { if (isFlipped) handleReview('easy'); }}
          disabled={!isFlipped}
        >
          <span>Easy</span>
          <span style={styles.buttonShortcut}>4</span>
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
  audioToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  audioButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px'
  },
  counter: {
    fontSize: '14px',
    color: '#3b82f6',
    fontWeight: 600,
    minWidth: '60px',
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
    userSelect: 'none'
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
  speakerButton: {
    marginTop: '20px',
    padding: '10px 20px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
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
    gap: '12px',
    padding: '24px',
    maxWidth: '600px',
    margin: '0 auto',
    width: '100%'
  },
  reviewBtn: {
    flex: 1,
    border: 'none',
    borderRadius: '16px',
    padding: '16px 8px',
    fontSize: '14px',
    fontWeight: 600,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: '#fff'
  },
  btnAgain: { backgroundColor: '#ef4444' }, // Red
  btnHard: { backgroundColor: '#f97316' },  // Orange
  btnGood: { backgroundColor: '#22c55e' },  // Green
  btnEasy: { backgroundColor: '#3b82f6' },  // Blue
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
    marginBottom: '32px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  statBox: {
    textAlign: 'center'
  },
  statValue: {
    fontSize: '36px',
    fontWeight: 700,
    color: '#3b82f6',
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
    cursor: 'pointer'
  },
  homeButton: {
    backgroundColor: '#fff',
    color: '#0f172a',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    padding: '14px 32px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  loading: {
    textAlign: 'center',
    marginTop: '48px',
    fontSize: '18px',
    color: '#64748b'
  }
};

export default Swipe;

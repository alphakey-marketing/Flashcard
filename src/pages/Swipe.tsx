import React, { useState, useEffect, CSSProperties, useCallback, useMemo } from 'react';
import { getSet, FlashcardSet, Card } from '../lib/storage';
import { audioService } from '../lib/audioService';
import { recordSession } from '../lib/studyStats';
import { saveCardReview, ReviewRating, getDueCards, getSetReviewData, getLearningCards } from '../lib/spacedRepetition';

interface SwipeProps {
  setId: string;
  onNavigateToHome: () => void;
}

const Swipe: React.FC<SwipeProps> = ({ setId, onNavigateToHome }) => {
  const [set, setSet] = useState<FlashcardSet | null>(null);
  const [activeQueue, setActiveQueue] = useState<Card[]>([]);
  const [currentCard, setCurrentCard] = useState<Card | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, knowIt: 0, mastered: 0 });
  const [totalCards, setTotalCards] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [sessionStartTime] = useState(Date.now());
  const [studyMode, setStudyMode] = useState<'due' | 'all'>('all');
  const [reverseMode, setReverseMode] = useState(false);

  // Memoized queue loading logic to prevent recreating function
  const loadQueue = useCallback((flashcardSet: FlashcardSet, mode: 'due' | 'all') => {
    const reviewedData = getSetReviewData(setId);
    const learningCards = getLearningCards(setId);
    const dueCardsData = getDueCards(setId);
    
    // Optimized: Create single Set for all priority cards
    const priorityCardIds = new Set([
      ...learningCards.map(d => d.cardId),
      ...dueCardsData.map(d => d.cardId)
    ]);
    
    let queueCards: Card[];
    
    if (mode === 'due') {
      // Show learning/reviewing cards (not mastered yet) + due mastered cards
      queueCards = flashcardSet.cards.filter(card => priorityCardIds.has(card.id));
      
      // If no learning/due cards, check if we have any new cards (never studied)
      if (queueCards.length === 0) {
        const reviewedIds = new Set(reviewedData.map(d => d.cardId));
        const newCards = flashcardSet.cards.filter(card => !reviewedIds.has(card.id));
        
        if (newCards.length > 0) {
          // Start with first 10 new cards
          queueCards = newCards.slice(0, 10);
        }
      }
    } else {
      // All cards, but learning/due cards first - optimized single pass
      const priorityCards: Card[] = [];
      const otherCards: Card[] = [];
      
      for (const card of flashcardSet.cards) {
        if (priorityCardIds.has(card.id)) {
          priorityCards.push(card);
        } else {
          otherCards.push(card);
        }
      }
      
      queueCards = [...priorityCards, ...otherCards];
    }

    setActiveQueue(queueCards);
    setCurrentCard(queueCards[0] || null);
    setTotalCards(queueCards.length);
    setStudyMode(mode);
  }, [setId]);

  useEffect(() => {
    const flashcardSet = getSet(setId);
    if (flashcardSet) {
      setSet(flashcardSet);
      
      // Check if user has any review history
      const reviewedData = getSetReviewData(setId);
      const hasSomeReviews = reviewedData.length > 0;
      
      // If they have review history, check for learning/due cards
      if (hasSomeReviews) {
        const learningCards = getLearningCards(setId);
        // If there are learning cards, start in due mode, otherwise all mode
        const initialMode = learningCards.length > 0 ? 'due' : 'all';
        loadQueue(flashcardSet, initialMode);
      } else {
        // First time studying this set - start in 'all' mode
        loadQueue(flashcardSet, 'all');
      }
    } else {
      onNavigateToHome();
    }
  }, [setId, onNavigateToHome, loadQueue]);

  const switchMode = useCallback((mode: 'due' | 'all') => {
    if (!set) return;
    loadQueue(set, mode);
    setSessionStats({ reviewed: 0, knowIt: 0, mastered: 0 });
    setIsFlipped(false);
    setIsFinished(false);
  }, [set, loadQueue]);

  const toggleReverseMode = useCallback(() => {
    setReverseMode(prev => !prev);
    setIsFlipped(false); // Reset flip state when switching modes
  }, []);

  const getCurrentFront = useCallback(() => {
    if (!currentCard) return '';
    return reverseMode ? currentCard.back : currentCard.front;
  }, [currentCard, reverseMode]);

  const getCurrentBack = useCallback(() => {
    if (!currentCard) return '';
    return reverseMode ? currentCard.front : currentCard.back;
  }, [currentCard, reverseMode]);

  // Handle parsing text into main text and example sentence
  const renderCardText = (text: string) => {
    if (!text) return null;
    const parts = text.split('\n');
    const mainText = parts[0];
    const extraText = parts.length > 1 ? parts.slice(1).join('\n').trim() : '';

    return (
      <div style={styles.cardTextContainer}>
        <div style={styles.cardText}>{mainText}</div>
        {extraText && (
          <div style={styles.exampleBox}>
            <div style={styles.exampleLabel}>例文 (Example)</div>
            <div style={styles.exampleText}>{extraText}</div>
          </div>
        )}
      </div>
    );
  };

  // Play audio sequence with pauses
  const playCardAudio = useCallback(() => {
    if (!currentCard) return;

    // We only play Japanese text, which is always stored in currentCard.front
    const frontText = currentCard.front;
    const parts = frontText.split('\n');
    const mainLine = parts[0].trim();
    const exampleText = parts.length > 1 ? parts.slice(1).join('\n').trim() : '';

    let kanji = mainLine;
    let kana = '';
    
    // Check for "Kanji[kana]" format
    const bracketMatch = mainLine.match(/^(.*?)\[(.*?)\]/);
    if (bracketMatch) {
      kanji = bracketMatch[1].trim();
      kana = bracketMatch[2].trim();
    } else {
      kanji = mainLine.split(/[\s-]/)[0].trim();
    }

    const sequence: { text: string; pauseAfter: number }[] = [];
    
    // If kanji and kana are present and different, play both with a 2-second wait in between
    if (kanji && kana && kanji !== kana) {
      sequence.push({ text: kanji, pauseAfter: 2000 });
      sequence.push({ text: kana, pauseAfter: exampleText ? 2000 : 0 });
    } else {
      sequence.push({ text: kanji, pauseAfter: exampleText ? 2000 : 0 });
    }

    if (exampleText) {
      sequence.push({ text: exampleText, pauseAfter: 0 });
    }

    audioService.playSequence(sequence);
  }, [currentCard]);

  // Memoize manual audio play handler
  const handlePlayAudio = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    playCardAudio();
  }, [playCardAudio]);

  // Cleanup audio when card changes
  useEffect(() => {
    audioService.stop();
  }, [currentCard]);

  // Auto-play audio logic
  useEffect(() => {
    if (!audioEnabled || !currentCard) return;

    // Recognition mode (JP -> EN): Front is Japanese -> play when NOT flipped
    // Production mode (EN -> JP): Back is Japanese -> play when FLIPPED
    const shouldPlay = (!reverseMode && !isFlipped) || (reverseMode && isFlipped);

    if (shouldPlay) {
      const timeoutId = setTimeout(() => {
        playCardAudio();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentCard, isFlipped, reverseMode, audioEnabled, playCardAudio]);

  const handleReview = useCallback((rating: ReviewRating) => {
    if (!currentCard || !set) return;

    // Save review to SM-2 system
    saveCardReview(set.id, currentCard.id, rating);
    
    // Update session stats using functional update to avoid stale closure
    setSessionStats(prev => ({
      reviewed: prev.reviewed + 1,
      knowIt: prev.knowIt + (rating === 'know_it' ? 1 : 0),
      mastered: prev.mastered + (rating === 'mastered' ? 1 : 0)
    }));

    // Optimized: Use slice instead of spread for large arrays
    const newQueue = activeQueue.slice(1);
    const reviewedCard = activeQueue[0];

    if (rating === 'again') {
      // Reinsert card a few positions back for immediate practice
      if (newQueue.length === 0) {
        newQueue.push(reviewedCard);
      } else {
        const insertIndex = Math.min(newQueue.length, Math.floor(Math.random() * 3) + 2);
        newQueue.splice(insertIndex, 0, reviewedCard);
      }
    }

    if (newQueue.length === 0) {
      // Session complete - use callback to get latest stats
      setSessionStats(latestStats => {
        const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
        recordSession({
          setId: set.id,
          setTitle: set.title,
          startTime: sessionStartTime,
          endTime: Date.now(),
          cardsStudied: totalCards,
          cardsMastered: latestStats.mastered,
          duration
        });
        return latestStats;
      });
      
      setIsFinished(true);
    } else {
      setActiveQueue(newQueue);
      setCurrentCard(newQueue[0]);
      setIsFlipped(false);
    }
  }, [currentCard, set, activeQueue, sessionStartTime, totalCards]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isFinished) return;

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsFlipped(prev => !prev);
          break;
        case '1':
          e.preventDefault();
          if (isFlipped) handleReview('mastered');
          break;
        case '2':
          e.preventDefault();
          if (isFlipped) handleReview('know_it');
          break;
        case '3':
          e.preventDefault();
          if (isFlipped) handleReview('again');
          break;
        case 'a':
        case 'A':
          e.preventDefault();
          if (currentCard) {
            playCardAudio();
          }
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          toggleReverseMode();
          break;
        case 'Escape':
          e.preventDefault();
          onNavigateToHome();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isFlipped, isFinished, handleReview, onNavigateToHome, currentCard, reverseMode, toggleReverseMode, playCardAudio]);

  const handleStudyAgain = useCallback(() => {
    if (!set) return;
    loadQueue(set, studyMode);
    setIsFlipped(false);
    setIsFinished(false);
    setSessionStats({ reviewed: 0, knowIt: 0, mastered: 0 });
  }, [set, studyMode, loadQueue]);

  // Memoize dynamic button styles to prevent recreation
  const dueModeButtonStyle = useMemo(() => ({
    ...styles.modeButton,
    backgroundColor: studyMode === 'due' ? '#3b82f6' : '#f1f5f9',
    color: studyMode === 'due' ? 'white' : '#64748b'
  }), [studyMode]);

  const allModeButtonStyle = useMemo(() => ({
    ...styles.modeButton,
    backgroundColor: studyMode === 'all' ? '#3b82f6' : '#f1f5f9',
    color: studyMode === 'all' ? 'white' : '#64748b'
  }), [studyMode]);

  const reverseModeButtonStyle = useMemo(() => ({
    ...styles.reverseModeButton,
    backgroundColor: reverseMode ? '#10b981' : '#f1f5f9',
    color: reverseMode ? 'white' : '#64748b',
    border: reverseMode ? '1px solid #10b981' : '1px solid #e2e8f0'
  }), [reverseMode]);

  const audioButtonStyle = useMemo(() => ({
    ...styles.audioButton,
    opacity: audioEnabled ? 1 : 0.4
  }), [audioEnabled]);

  const progressBarStyle = useMemo(() => {
    const progress = totalCards > 0 ? Math.min(100, ((totalCards - activeQueue.length) / totalCards) * 100) : 0;
    return { ...styles.progressBar, width: `${progress}%` };
  }, [totalCards, activeQueue.length]);

  if (!set) {
    return (
      <div style={styles.container}>
        <p style={styles.loading}>Loading...</p>
      </div>
    );
  }

  // No cards in queue
  if (!currentCard && !isFinished) {
    const learningCards = getLearningCards(setId);
    const reviewedData = getSetReviewData(setId);
    const allReviewed = reviewedData.length === set.cards.length;
    
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <button style={styles.closeButton} onClick={onNavigateToHome}>✕</button>
          <h2 style={styles.headerTitle}>{set.title}</h2>
          <div style={{ width: '40px' }} />
        </header>

        <div style={styles.finishedContainer}>
          <div style={styles.finishedIcon}>✅</div>
          <h1 style={styles.finishedTitle}>All caught up!</h1>
          <p style={styles.finishedText}>
            {allReviewed 
              ? 'You\'ve reviewed all cards. Come back later for more reviews!' 
              : 'No cards due right now. Great work!'}
          </p>
          
          <div style={styles.finishedButtons}>
            {set.cards.length > reviewedData.length && (
              <button style={styles.studyAgainButton} onClick={() => switchMode('all')}>
                Study All Cards
              </button>
            )}
            <button style={styles.homeButton} onClick={onNavigateToHome}>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isFinished) {
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
    const minutesStudied = Math.floor(duration / 60);
    const secondsStudied = duration % 60;

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
              <div style={styles.statValue}>{sessionStats.reviewed}</div>
              <div style={styles.statLabel}>Reviews</div>
            </div>
            <div style={styles.statBox}>
              <div style={styles.statValue}>{sessionStats.mastered}</div>
              <div style={styles.statLabel}>🎯 Mastered</div>
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
              Study Again
            </button>
            {studyMode === 'due' && (
              <button 
                style={switchToAllButtonStyle}
                onClick={() => switchMode('all')}
              >
                Study All Cards
              </button>
            )}
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
          <div style={styles.modeToggle}>
            <button
              style={dueModeButtonStyle}
              onClick={() => switchMode('due')}
            >
              Due
            </button>
            <button
              style={allModeButtonStyle}
              onClick={() => switchMode('all')}
            >
              All
            </button>
          </div>
          <button
            style={audioButtonStyle}
            onClick={() => setAudioEnabled(!audioEnabled)}
            title={audioEnabled ? 'Audio ON' : 'Audio OFF'}
          >
            {audioEnabled ? '🔊' : '🔇'}
          </button>
          <span style={styles.counter}>{activeQueue.length} left</span>
        </div>
      </header>

      <div style={styles.progressBarContainer}>
        <div style={progressBarStyle} />
      </div>

      <div style={styles.reverseModeContainer}>
        <button
          style={reverseModeButtonStyle}
          onClick={toggleReverseMode}
          title="Toggle between JP→EN and EN→JP (Press R)"
        >
          <span style={styles.reverseModeIcon}>{reverseMode ? '🔄' : '➡️'}</span>
          <span style={styles.reverseModeText}>
            {reverseMode ? 'EN → JP (Production)' : 'JP → EN (Recognition)'}
          </span>
        </button>
      </div>

      <div style={styles.cardContainer}>
        <div style={styles.flashcard} onClick={() => setIsFlipped(!isFlipped)}>
          <div style={styles.cardContent}>
            {!isFlipped ? (
              <>
                <div style={styles.cardLabel}>FRONT</div>
                {renderCardText(getCurrentFront())}
                <div style={styles.tapHint}>👆 Tap to flip (or press Space)</div>
              </>
            ) : (
              <>
                <div style={styles.cardLabel}>BACK</div>
                {renderCardText(getCurrentBack())}
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
          <span style={styles.hint}><kbd style={styles.kbd}>R</kbd> Reverse</span>
          <span style={styles.hint}><kbd style={styles.kbd}>1</kbd> Mastered</span>
          <span style={styles.hint}><kbd style={styles.kbd}>2</kbd> Know It</span>
          <span style={styles.hint}><kbd style={styles.kbd}>3</kbd> Again</span>
          <span style={styles.hint}><kbd style={styles.kbd}>A</kbd> Audio</span>
        </div>
      </div>

      <div style={styles.actions}>
        <button
          style={{ ...styles.reviewBtn, ...styles.btnMastered, opacity: !isFlipped ? 0.5 : 1 }}
          onClick={() => { if (isFlipped) handleReview('mastered'); }}
          disabled={!isFlipped}
        >
          <span style={styles.emoji}>🎯</span>
          <span>Mastered</span>
          <span style={styles.buttonShortcut}>1</span>
        </button>
        <button
          style={{ ...styles.reviewBtn, ...styles.btnKnowIt, opacity: !isFlipped ? 0.5 : 1 }}
          onClick={() => { if (isFlipped) handleReview('know_it'); }}
          disabled={!isFlipped}
        >
          <span style={styles.emoji}>😊</span>
          <span>Know It</span>
          <span style={styles.buttonShortcut}>2</span>
        </button>
        <button
          style={{ ...styles.reviewBtn, ...styles.btnAgain, opacity: !isFlipped ? 0.5 : 1 }}
          onClick={() => { if (isFlipped) handleReview('again'); }}
          disabled={!isFlipped}
        >
          <span style={styles.emoji}>😰</span>
          <span>Again</span>
          <span style={styles.buttonShortcut}>3</span>
        </button>
      </div>
    </div>
  );
};

// Extract static style for "Switch to All" button
const switchToAllButtonStyle: CSSProperties = {
  backgroundColor: '#3b82f6',
  color: 'white',
  border: '2px solid #e2e8f0',
  borderRadius: '12px',
  padding: '14px 32px',
  fontSize: '16px',
  fontWeight: 600,
  cursor: 'pointer'
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
  modeToggle: {
    display: 'flex',
    gap: '4px',
    backgroundColor: '#f1f5f9',
    borderRadius: '8px',
    padding: '2px'
  },
  modeButton: {
    border: 'none',
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
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
  reverseModeContainer: {
    padding: '12px 24px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'center'
  },
  reverseModeButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  reverseModeIcon: {
    fontSize: '16px'
  },
  reverseModeText: {
    fontSize: '13px'
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
  cardTextContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    gap: '24px'
  },
  cardText: {
    fontSize: '32px',
    fontWeight: 600,
    color: '#0f172a',
    lineHeight: '1.5',
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap'
  },
  exampleBox: {
    backgroundColor: '#f8fafc',
    borderLeft: '4px solid #3b82f6',
    borderRadius: '0 12px 12px 0',
    padding: '16px',
    width: '100%',
    maxWidth: '450px',
    textAlign: 'left'
  },
  exampleLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: '#64748b',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  exampleText: {
    fontSize: '18px',
    color: '#334155',
    lineHeight: '1.6',
    fontWeight: 500
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
  emoji: {
    fontSize: '24px',
    marginBottom: '4px'
  },
  btnAgain: { backgroundColor: '#ef4444' },
  btnKnowIt: { backgroundColor: '#22c55e' },
  btnMastered: { backgroundColor: '#3b82f6' },
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
    marginBottom: '32px',
    textAlign: 'center'
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

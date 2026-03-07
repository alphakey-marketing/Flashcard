import React, { useState, useEffect, CSSProperties, useCallback, useMemo } from 'react';
import { getSet, FlashcardSet, Card } from '../lib/storage';
import { audioService } from '../lib/audioService';
import { recordSession } from '../lib/studyStats';
import { saveCardReview, ReviewRating, getDueCards, getSetReviewData, getLearningCards } from '../lib/spacedRepetition';

interface SwipeProps {
  setId: string;
  onNavigateToHome: () => void;
}

interface SavedSwipeSession {
  setId: string;
  activeQueue: Card[];
  studyMode: 'due' | 'all';
  reverseMode: boolean;
  sessionStats: { reviewed: number; knowIt: number; mastered: number };
  timestamp: number;
}

const STORAGE_KEY = 'swipe-mode-session';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

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
  const [hasUserInteracted, setHasUserInteracted] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedSession, setSavedSession] = useState<SavedSwipeSession | null>(null);

  const loadSavedSession = (): SavedSwipeSession | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;
      
      const session: SavedSwipeSession = JSON.parse(saved);
      
      // Check if session is expired
      if (Date.now() - session.timestamp > SESSION_EXPIRY_MS) {
        localStorage.removeItem(STORAGE_KEY);
        return null;
      }
      
      return session;
    } catch (error) {
      console.error('Error loading saved session:', error);
      return null;
    }
  };

  const saveCurrentSession = useCallback(() => {
    if (activeQueue.length === 0 || isFinished) return;
    
    try {
      const session: SavedSwipeSession = {
        setId,
        activeQueue,
        studyMode,
        reverseMode,
        sessionStats,
        timestamp: Date.now()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  }, [setId, activeQueue, studyMode, reverseMode, sessionStats, isFinished]);

  const clearSavedSession = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  };

  const handleResumeSession = () => {
    if (savedSession) {
      setActiveQueue(savedSession.activeQueue);
      setCurrentCard(savedSession.activeQueue[0] || null);
      setTotalCards(savedSession.activeQueue.length);
      setStudyMode(savedSession.studyMode);
      setReverseMode(savedSession.reverseMode);
      setSessionStats(savedSession.sessionStats);
      setShowResumePrompt(false);
    }
  };

  const handleStartNewSession = () => {
    clearSavedSession();
    setShowResumePrompt(false);
    // Will trigger loadQueue in the next useEffect
  };

  // Auto-save session when state changes
  useEffect(() => {
    saveCurrentSession();
  }, [saveCurrentSession]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      saveCurrentSession();
    };
  }, [saveCurrentSession]);

  // Fisher-Yates shuffle algorithm
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

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
      const dueCards = flashcardSet.cards.filter(card => priorityCardIds.has(card.id));
      
      // If no learning/due cards, check if we have any new cards (never studied)
      if (dueCards.length === 0) {
        const reviewedIds = new Set(reviewedData.map(d => d.cardId));
        const newCards = flashcardSet.cards.filter(card => !reviewedIds.has(card.id));
        
        if (newCards.length > 0) {
          // Start with first 10 new cards, randomized
          queueCards = shuffleArray(newCards.slice(0, 10));
        } else {
          queueCards = [];
        }
      } else {
        // Randomize due cards
        queueCards = shuffleArray(dueCards);
      }
    } else {
      // All cards: priority cards first (randomized), then other cards (randomized)
      const priorityCards: Card[] = [];
      const otherCards: Card[] = [];
      
      for (const card of flashcardSet.cards) {
        if (priorityCardIds.has(card.id)) {
          priorityCards.push(card);
        } else {
          otherCards.push(card);
        }
      }
      
      // Randomize each group separately, then combine
      queueCards = [
        ...shuffleArray(priorityCards),
        ...shuffleArray(otherCards)
      ];
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
      
      // Check for saved session first
      const saved = loadSavedSession();
      if (saved && saved.setId === setId && saved.activeQueue.length > 0) {
        setSavedSession(saved);
        setShowResumePrompt(true);
        return;
      }
      
      // No saved session, start new
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
    clearSavedSession(); // Clear saved session when explicitly switching modes
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
    if (!currentCard || !audioService.isSupported()) return;

    // Mark that user has interacted (for mobile autoplay)
    setHasUserInteracted(true);

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

  // Auto-play audio logic - ONLY for Japanese side
  useEffect(() => {
    if (!audioEnabled || !currentCard || !audioService.isSupported()) return;

    // On mobile, require user interaction first before auto-playing
    if (!hasUserInteracted && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      return;
    }

    // Recognition mode (JP -> EN): Front is Japanese -> play when NOT flipped
    // Production mode (EN -> JP): Back is Japanese -> play when FLIPPED
    // IMPORTANT: Only auto-play when Japanese is visible
    const isJapaneseSideVisible = (!reverseMode && !isFlipped) || (reverseMode && isFlipped);

    if (isJapaneseSideVisible) {
      const timeoutId = setTimeout(() => {
        playCardAudio();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentCard, isFlipped, reverseMode, audioEnabled, playCardAudio, hasUserInteracted]);

  const handleReview = useCallback((rating: ReviewRating) => {
    if (!currentCard || !set) return;

    // Mark user interaction on first review
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }

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
      
      clearSavedSession(); // Clear saved session on completion
      setIsFinished(true);
    } else {
      setActiveQueue(newQueue);
      setCurrentCard(newQueue[0]);
      setIsFlipped(false);
    }
  }, [currentCard, set, activeQueue, sessionStartTime, totalCards, hasUserInteracted]);

  // Handle card flip with user interaction tracking
  const handleFlipCard = useCallback(() => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }
    setIsFlipped(prev => !prev);
  }, [hasUserInteracted]);

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
          handleFlipCard();
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
  }, [isFlipped, isFinished, handleReview, onNavigateToHome, currentCard, reverseMode, toggleReverseMode, playCardAudio, handleFlipCard]);

  const handleStudyAgain = useCallback(() => {
    if (!set) return;
    clearSavedSession(); // Clear saved session when starting fresh
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

  // Resume prompt screen
  if (showResumePrompt && savedSession) {
    const cardsLeft = savedSession.activeQueue.length;
    const progress = totalCards > 0 ? Math.round(((totalCards - cardsLeft) / totalCards) * 100) : 0;
    
    return (
      <div style={styles.container}>
        <div style={styles.resumeContainer}>
          <div style={styles.resumeCard}>
            <div style={styles.resumeIcon}>💭</div>
            <h2 style={styles.resumeTitle}>Resume Session?</h2>
            <p style={styles.resumeText}>
              You have an in-progress review session.
            </p>
            <div style={styles.resumeStats}>
              <div style={styles.resumeStatItem}>
                <span style={styles.resumeStatValue}>{cardsLeft}</span>
                <span style={styles.resumeStatLabel}>Cards Remaining</span>
              </div>
              <div style={styles.resumeStatItem}>
                <span style={styles.resumeStatValue}>{savedSession.sessionStats.reviewed}</span>
                <span style={styles.resumeStatLabel}>Already Reviewed</span>
              </div>
            </div>
            <div style={styles.resumeButtons}>
              <button
                style={styles.primaryButton}
                onClick={handleResumeSession}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                ▶️ Resume Session
              </button>
              <button
                style={styles.secondaryButton}
                onClick={handleStartNewSession}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                🔄 Start New Session
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
        <div style={styles.flashcard} onClick={handleFlipCard}>
          <div style={styles.cardContent}>
            {!isFlipped ? (
              <>
                <div style={styles.cardLabel}>FRONT</div>
                {renderCardText(getCurrentFront())}
                <button style={styles.speakerButton} onClick={handlePlayAudio} title="Play audio (A)">
                  🔊 Listen
                </button>
                <div style={styles.tapHint}>👆 Tap to flip (or press Space)</div>
              </>
            ) : (
              <>
                <div style={styles.cardLabel}>BACK</div>
                {renderCardText(getCurrentBack())}
                <button style={styles.speakerButton} onClick={handlePlayAudio} title="Play audio (A)">
                  🔊 Listen
                </button>
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
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#64748b',
    padding: '4px',
    width: '32px'
  },
  headerTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
    flex: 1,
    textAlign: 'center'
  },
  audioToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
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
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  audioButton: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px'
  },
  counter: {
    fontSize: '12px',
    color: '#3b82f6',
    fontWeight: 600,
    minWidth: '50px',
    textAlign: 'right'
  },
  reverseModeContainer: {
    padding: '8px 16px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'center'
  },
  reverseModeButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '8px',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  reverseModeIcon: {
    fontSize: '14px'
  },
  reverseModeText: {
    fontSize: '11px'
  },
  progressBarContainer: {
    height: '3px',
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
    padding: '12px 16px',
    gap: '12px'
  },
  flashcard: {
    width: '100%',
    maxWidth: '500px',
    minHeight: '200px',
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    transition: 'transform 0.2s',
    border: '2px solid #e2e8f0',
    userSelect: 'none'
  },
  cardContent: {
    textAlign: 'center',
    width: '100%'
  },
  cardLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#64748b',
    letterSpacing: '1px',
    marginBottom: '16px'
  },
  cardTextContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
    gap: '16px'
  },
  cardText: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#0f172a',
    lineHeight: '1.4',
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap'
  },
  exampleBox: {
    backgroundColor: '#f8fafc',
    borderLeft: '3px solid #3b82f6',
    borderRadius: '0 8px 8px 0',
    padding: '12px',
    width: '100%',
    maxWidth: '380px',
    textAlign: 'left'
  },
  exampleLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#64748b',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  exampleText: {
    fontSize: '14px',
    color: '#334155',
    lineHeight: '1.5',
    fontWeight: 500
  },
  tapHint: {
    fontSize: '12px',
    color: '#94a3b8',
    marginTop: '16px'
  },
  speakerButton: {
    marginTop: '16px',
    padding: '8px 16px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  queueInfo: {
    fontSize: '12px',
    color: '#64748b',
    textAlign: 'center',
    padding: '6px 12px',
    backgroundColor: '#fff',
    borderRadius: '16px',
    border: '1px solid #e2e8f0'
  },
  keyboardHints: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    fontSize: '10px',
    color: '#94a3b8'
  },
  hint: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  kbd: {
    backgroundColor: '#f1f5f9',
    border: '1px solid #cbd5e1',
    borderRadius: '3px',
    padding: '2px 4px',
    fontFamily: 'monospace',
    fontSize: '9px',
    color: '#475569'
  },
  actions: {
    display: 'flex',
    gap: '8px',
    padding: '12px 16px',
    maxWidth: '500px',
    margin: '0 auto',
    width: '100%'
  },
  reviewBtn: {
    flex: 1,
    border: 'none',
    borderRadius: '12px',
    padding: '12px 6px',
    fontSize: '12px',
    fontWeight: 600,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '3px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: '#fff'
  },
  emoji: {
    fontSize: '20px',
    marginBottom: '2px'
  },
  btnAgain: { backgroundColor: '#ef4444' },
  btnKnowIt: { backgroundColor: '#22c55e' },
  btnMastered: { backgroundColor: '#3b82f6' },
  buttonShortcut: {
    fontSize: '10px',
    opacity: 0.8,
    fontWeight: 400
  },
  resumeContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px'
  },
  resumeCard: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '48px',
    maxWidth: '500px',
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
  },
  resumeIcon: {
    fontSize: '64px',
    marginBottom: '24px'
  },
  resumeTitle: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '16px'
  },
  resumeText: {
    fontSize: '16px',
    color: '#64748b',
    marginBottom: '32px'
  },
  resumeStats: {
    display: 'flex',
    gap: '48px',
    justifyContent: 'center',
    marginBottom: '32px'
  },
  resumeStatItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  resumeStatValue: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#3b82f6'
  },
  resumeStatLabel: {
    fontSize: '14px',
    color: '#64748b',
    fontWeight: 500
  },
  resumeButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  primaryButton: {
    padding: '16px 32px',
    fontSize: '16px',
    fontWeight: 600,
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  secondaryButton: {
    padding: '16px 32px',
    fontSize: '16px',
    fontWeight: 600,
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
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

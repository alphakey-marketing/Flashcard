import React, { useState, useEffect, CSSProperties, useCallback, useMemo } from 'react';
import { getSet, getAllSets, FlashcardSet, Card } from '../lib/storage';
import { audioService } from '../lib/audioService';
import { recordSession } from '../lib/studyStats';
import { saveCardReview, ReviewRating, getDailyQueueCardIds, getSetReviewData } from '../lib/spacedRepetition';

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
const MAX_AGAIN_REQUEUES_PER_SESSION = 2;

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

  // Per-session "Again" requeue counter — reset on each new session start
  const againCountsRef = React.useRef<Map<string, number>>(new Map());

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
    againCountsRef.current = new Map();
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
    let queueCards: Card[] = [];

    if (flashcardSet.id === 'due-today') {
      // For 'due-today', the flashcardSet.cards already contains ONLY the due cards.
      // We just need to shuffle them.
      queueCards = shuffleArray(flashcardSet.cards);
    } else {
      if (mode === 'due') {
        // Build today's capped queue: learning → review → new
        const allCardIds = flashcardSet.cards.map(c => c.id);
        const dailyIds = getDailyQueueCardIds(setId, allCardIds);
        const dailyIdSet = new Set(dailyIds);
        const cardById = new Map(flashcardSet.cards.map(c => [c.id, c]));
        // Maintain bucket order (learning first, then review, then new) with shuffle within each group
        const learningCards: Card[] = [];
        const reviewCards: Card[] = [];
        const newCards: Card[] = [];
        const reviewData = getSetReviewData(setId);
        const reviewDataMap = new Map(reviewData.map(d => [d.cardId, d]));
        const reviewedIds = new Set(reviewData.map(d => d.cardId));

        for (const id of dailyIds) {
          const card = cardById.get(id);
          if (!card) continue;
          if (!reviewedIds.has(id)) {
            newCards.push(card);
          } else {
            const data = reviewDataMap.get(id);
            if (data?.status === 'learning') {
              learningCards.push(card);
            } else {
              reviewCards.push(card);
            }
          }
        }

        queueCards = [
          ...shuffleArray(learningCards),
          ...shuffleArray(reviewCards),
          ...shuffleArray(newCards),
        ];
      } else {
        // All cards mode: due/learning cards first (shuffled), then other cards (shuffled)
        const allCardIds = flashcardSet.cards.map(c => c.id);
        const dailyIds = getDailyQueueCardIds(setId, allCardIds);
        const dailyIdSet = new Set(dailyIds);

        const priorityCards: Card[] = [];
        const otherCards: Card[] = [];

        for (const card of flashcardSet.cards) {
          if (dailyIdSet.has(card.id)) {
            priorityCards.push(card);
          } else {
            otherCards.push(card);
          }
        }

        queueCards = [
          ...shuffleArray(priorityCards),
          ...shuffleArray(otherCards),
        ];
      }
    }

    setActiveQueue(queueCards);
    setCurrentCard(queueCards[0] || null);
    setTotalCards(queueCards.length);
    setStudyMode(mode);
  }, [setId]);

  useEffect(() => {
    let flashcardSet: FlashcardSet | undefined;
    
    if (setId === 'due-today') {
      const allSets = getAllSets();
      let allDueCards: Card[] = [];
      
      allSets.forEach(s => {
        const dailyIds = getDailyQueueCardIds(s.id, s.cards.map(c => c.id));
        const dailyIdSet = new Set(dailyIds);
        const dueCardsForSet = s.cards.filter(c => dailyIdSet.has(c.id)).map(c => ({
          ...c,
          setId: s.id // Inject original set ID for tracking!
        }));
        allDueCards = [...allDueCards, ...dueCardsForSet];
      });

      flashcardSet = {
        id: 'due-today',
        title: 'Review Due Today',
        description: 'All your due cards across all sets.',
        cards: allDueCards,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
    } else {
      flashcardSet = getSet(setId);
    }
    
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
      if (setId === 'due-today') {
        loadQueue(flashcardSet, 'due');
      } else {
        const reviewedData = getSetReviewData(setId);
        const hasSomeReviews = reviewedData.length > 0;
        
        if (hasSomeReviews) {
          const dailyIds = getDailyQueueCardIds(setId, flashcardSet.cards.map(c => c.id));
          const initialMode = dailyIds.length > 0 ? 'due' : 'all';
          loadQueue(flashcardSet, initialMode);
        } else {
          loadQueue(flashcardSet, 'all');
        }
      }
    } else {
      onNavigateToHome();
    }
  }, [setId, onNavigateToHome, loadQueue]);

  const switchMode = useCallback((mode: 'due' | 'all') => {
    if (!set) return;
    if (setId === 'due-today') return; // Cannot switch mode in global due view
    clearSavedSession(); // Clear saved session when explicitly switching modes
    loadQueue(set, mode);
    setSessionStats({ reviewed: 0, knowIt: 0, mastered: 0 });
    setIsFlipped(false);
    setIsFinished(false);
  }, [set, loadQueue, setId]);

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

  const playCardAudio = useCallback(() => {
    if (!currentCard || !audioService.isSupported()) return;

    setHasUserInteracted(true);

    const frontText = currentCard.front;
    const parts = frontText.split('\n');
    const mainLine = parts[0].trim();
    const exampleText = parts.length > 1 ? parts.slice(1).join('\n').trim() : '';

    let kanji = mainLine;
    let kana = '';
    
    const bracketMatch = mainLine.match(/^(.*?)\[(.*?)\]/);
    if (bracketMatch) {
      kanji = bracketMatch[1].trim();
      kana = bracketMatch[2].trim();
    } else {
      kanji = mainLine.split(/[\s-]/)[0].trim();
    }

    const sequence: { text: string; pauseAfter: number }[] = [];
    
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

  const handlePlayAudio = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    playCardAudio();
  }, [playCardAudio]);

  useEffect(() => {
    audioService.stop();
  }, [currentCard]);

  useEffect(() => {
    if (!audioEnabled || !currentCard || !audioService.isSupported()) return;

    if (!hasUserInteracted && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      return;
    }

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

    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }

    // Determine the actual set ID for this card. 
    // In 'due-today' mode, currentCard.setId has the original set ID.
    const actualSetId = (currentCard as any).setId || set.id;

    // Save review to SM-2 system
    saveCardReview(actualSetId, currentCard.id, rating);
    
    setSessionStats(prev => ({
      reviewed: prev.reviewed + 1,
      knowIt: prev.knowIt + (rating === 'know_it' ? 1 : 0),
      mastered: prev.mastered + (rating === 'mastered' ? 1 : 0)
    }));

    const newQueue = activeQueue.slice(1);
    const reviewedCard = activeQueue[0];

    if (rating === 'again') {
      // Limit how many times a card can be requeued in the same session to prevent infinite loops.
      const cardKey = reviewedCard.id;
      const count = againCountsRef.current.get(cardKey) ?? 0;
      againCountsRef.current.set(cardKey, count + 1);

      if (count < MAX_AGAIN_REQUEUES_PER_SESSION && newQueue.length >= 2) {
        const insertIndex = Math.min(newQueue.length, Math.floor(Math.random() * 3) + 2);
        newQueue.splice(insertIndex, 0, reviewedCard);
      }
      // If at limit or queue too short: do not requeue — scheduling will handle the next appearance.
    }

    if (newQueue.length === 0) {
      setSessionStats(latestStats => {
        const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
        
        // Only record session if it's a real set
        if (set.id !== 'due-today') {
          recordSession({
            setId: set.id,
            setTitle: set.title,
            startTime: sessionStartTime,
            endTime: Date.now(),
            cardsStudied: totalCards,
            cardsMastered: latestStats.mastered,
            duration
          });
        }
        return latestStats;
      });
      
      clearSavedSession();
      setIsFinished(true);
    } else {
      setActiveQueue(newQueue);
      setCurrentCard(newQueue[0]);
      setIsFlipped(false);
    }
  }, [currentCard, set, activeQueue, sessionStartTime, totalCards, hasUserInteracted]);

  const handleFlipCard = useCallback(() => {
    if (!hasUserInteracted) {
      setHasUserInteracted(true);
    }
    setIsFlipped(prev => !prev);
  }, [hasUserInteracted]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (isFinished) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

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
          if (currentCard) playCardAudio();
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
    clearSavedSession();
    againCountsRef.current = new Map();
    loadQueue(set, studyMode);
    setIsFlipped(false);
    setIsFinished(false);
    setSessionStats({ reviewed: 0, knowIt: 0, mastered: 0 });
  }, [set, studyMode, loadQueue]);

  const dueModeButtonStyle = useMemo(() => ({
    ...styles.modeButton,
    backgroundColor: studyMode === 'due' ? '#3b82f6' : '#f1f5f9',
    color: studyMode === 'due' ? 'white' : '#64748b',
    display: setId === 'due-today' ? 'none' : 'block'
  }), [studyMode, setId]);

  const allModeButtonStyle = useMemo(() => ({
    ...styles.modeButton,
    backgroundColor: studyMode === 'all' ? '#3b82f6' : '#f1f5f9',
    color: studyMode === 'all' ? 'white' : '#64748b',
    display: setId === 'due-today' ? 'none' : 'block'
  }), [studyMode, setId]);

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
              <button style={styles.primaryButton} onClick={handleResumeSession}>
                ▶️ Resume Session
              </button>
              <button style={styles.secondaryButton} onClick={handleStartNewSession}>
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

  if (!currentCard && !isFinished) {
    const isDueToday = setId === 'due-today';
    const message = isDueToday 
      ? 'No cards due right now across any of your sets. Great work!'
      : 'You\'ve reviewed all cards. Come back later for more reviews!';
      
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
          <p style={styles.finishedText}>{message}</p>
          
          <div style={styles.finishedButtons}>
            {!isDueToday && (
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
            {studyMode === 'due' && setId !== 'due-today' && (
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
            <button style={dueModeButtonStyle} onClick={() => switchMode('due')}>Due</button>
            <button style={allModeButtonStyle} onClick={() => switchMode('all')}>All</button>
          </div>
          <button style={audioButtonStyle} onClick={() => setAudioEnabled(!audioEnabled)}>
            {audioEnabled ? '🔊' : '🔇'}
          </button>
          <span style={styles.counter}>{activeQueue.length} left</span>
        </div>
      </header>

      <div style={styles.progressBarContainer}>
        <div style={progressBarStyle} />
      </div>

      <div style={styles.reverseModeContainer}>
        <button style={reverseModeButtonStyle} onClick={toggleReverseMode}>
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
                <button style={styles.speakerButton} onClick={handlePlayAudio}>🔊 Listen</button>
                <div style={styles.tapHint}>👆 Tap to flip (or press Space)</div>
              </>
            ) : (
              <>
                <div style={styles.cardLabel}>BACK</div>
                {renderCardText(getCurrentBack())}
                <button style={styles.speakerButton} onClick={handlePlayAudio}>🔊 Listen</button>
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
  container: { minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' },
  header: { backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeButton: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b', padding: '4px', width: '32px' },
  headerTitle: { fontSize: '14px', fontWeight: 600, color: '#0f172a', margin: 0, flex: 1, textAlign: 'center' },
  audioToggle: { display: 'flex', alignItems: 'center', gap: '8px' },
  modeToggle: { display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '2px' },
  modeButton: { border: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' },
  audioButton: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', padding: '4px' },
  counter: { fontSize: '12px', color: '#3b82f6', fontWeight: 600, minWidth: '50px', textAlign: 'right' },
  reverseModeContainer: { padding: '8px 16px', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' },
  reverseModeButton: { display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' },
  reverseModeIcon: { fontSize: '14px' },
  reverseModeText: { fontSize: '11px' },
  progressBarContainer: { height: '3px', backgroundColor: '#e2e8f0', width: '100%' },
  progressBar: { height: '100%', backgroundColor: '#3b82f6', transition: 'width 0.3s' },
  cardContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 16px', gap: '12px' },
  flashcard: { width: '100%', maxWidth: '500px', minHeight: '200px', backgroundColor: '#fff', borderRadius: '16px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', transition: 'transform 0.2s', border: '2px solid #e2e8f0', userSelect: 'none' },
  cardContent: { textAlign: 'center', width: '100%' },
  cardLabel: { fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '1px', marginBottom: '16px' },
  cardTextContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '16px' },
  cardText: { fontSize: '24px', fontWeight: 600, color: '#0f172a', lineHeight: '1.4', wordWrap: 'break-word', whiteSpace: 'pre-wrap' },
  exampleBox: { backgroundColor: '#f8fafc', borderLeft: '3px solid #3b82f6', borderRadius: '0 8px 8px 0', padding: '12px', width: '100%', maxWidth: '380px', textAlign: 'left' },
  exampleLabel: { fontSize: '10px', fontWeight: 700, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  exampleText: { fontSize: '14px', color: '#334155', lineHeight: '1.5', fontWeight: 500 },
  tapHint: { fontSize: '12px', color: '#94a3b8', marginTop: '16px' },
  speakerButton: { marginTop: '16px', padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  queueInfo: { fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '6px 12px', backgroundColor: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' },
  keyboardHints: { display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', fontSize: '10px', color: '#94a3b8' },
  hint: { display: 'flex', alignItems: 'center', gap: '4px' },
  kbd: { backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '3px', padding: '2px 4px', fontFamily: 'monospace', fontSize: '9px', color: '#475569' },
  actions: { display: 'flex', gap: '8px', padding: '12px 16px', maxWidth: '500px', margin: '0 auto', width: '100%' },
  reviewBtn: { flex: 1, border: 'none', borderRadius: '12px', padding: '12px 6px', fontSize: '12px', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '3px', cursor: 'pointer', transition: 'all 0.2s', color: '#fff' },
  emoji: { fontSize: '20px', marginBottom: '2px' },
  btnAgain: { backgroundColor: '#ef4444' },
  btnKnowIt: { backgroundColor: '#22c55e' },
  btnMastered: { backgroundColor: '#3b82f6' },
  buttonShortcut: { fontSize: '10px', opacity: 0.8, fontWeight: 400 },
  resumeContainer: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  resumeCard: { backgroundColor: '#fff', borderRadius: '24px', padding: '48px', maxWidth: '500px', textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' },
  resumeIcon: { fontSize: '64px', marginBottom: '24px' },
  resumeTitle: { fontSize: '32px', fontWeight: 700, color: '#0f172a', marginBottom: '16px' },
  resumeText: { fontSize: '16px', color: '#64748b', marginBottom: '32px' },
  resumeStats: { display: 'flex', gap: '48px', justifyContent: 'center', marginBottom: '32px' },
  resumeStatItem: { display: 'flex', flexDirection: 'column', gap: '8px' },
  resumeStatValue: { fontSize: '28px', fontWeight: 700, color: '#3b82f6' },
  resumeStatLabel: { fontSize: '14px', color: '#64748b', fontWeight: 500 },
  resumeButtons: { display: 'flex', flexDirection: 'column', gap: '12px' },
  primaryButton: { padding: '16px 32px', fontSize: '16px', fontWeight: 600, backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'opacity 0.2s' },
  secondaryButton: { padding: '16px 32px', fontSize: '16px', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'opacity 0.2s' },
  finishedContainer: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' },
  finishedIcon: { fontSize: '64px', marginBottom: '16px' },
  finishedTitle: { fontSize: '32px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' },
  finishedText: { fontSize: '16px', color: '#64748b', marginBottom: '32px', textAlign: 'center' },
  statsContainer: { display: 'flex', gap: '24px', marginBottom: '32px', flexWrap: 'wrap', justifyContent: 'center' },
  statBox: { textAlign: 'center' },
  statValue: { fontSize: '36px', fontWeight: 700, color: '#3b82f6', marginBottom: '4px' },
  statLabel: { fontSize: '14px', color: '#64748b', fontWeight: 500 },
  finishedButtons: { display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '300px' },
  studyAgainButton: { backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', padding: '14px 32px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' },
  homeButton: { backgroundColor: '#fff', color: '#0f172a', border: '2px solid #e2e8f0', borderRadius: '12px', padding: '14px 32px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' },
  loading: { textAlign: 'center', marginTop: '48px', fontSize: '18px', color: '#64748b' }
};

export default Swipe;

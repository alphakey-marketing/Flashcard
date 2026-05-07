import React, { useState, useEffect, CSSProperties } from 'react';
import { FlashcardSet, Flashcard } from '../lib/storage';
import { CardReviewData, saveCardReview, ReviewRating, getSetReviewData } from '../lib/spacedRepetition';
import { audioService } from '../lib/audioService';
import { checkAnswerWithDetails, MatchResult } from '../lib/answerMatcher';

interface LearnModeProps {
  set: FlashcardSet;
  onExit: () => void;
  onComplete: () => void;
}

type QuestionType = 'multiple-choice' | 'type-in' | 'flashcard';

interface Question {
  card: Flashcard;
  type: QuestionType;
  options?: string[]; // For multiple choice
}

interface SavedSession {
  setId: string;
  questions: Question[];
  currentIndex: number;
  correctCount: number;
  timestamp: number;
  /** Whether the session uses Back→Front direction (reversed) instead of the default Front→Back */
  isReversed?: boolean;
}

const STORAGE_KEY = 'learn-mode-session';
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_NEW_CARDS_PER_SESSION = 10;
const SESSION_SIZE = 20;

const SRGuideContent: React.FC = () => (
  <div style={styles.srGuideContent}>
    <p style={styles.srGuideText}>
      This app uses <strong>Spaced Repetition</strong> — based on the Forgetting Curve. Cards are shown at increasing intervals based on how well you know them:
    </p>
    <div style={styles.srGuideItem}><span style={styles.srBadgeRed}>Again</span> New cards: shown again in this session • Reviewing cards: reset to tomorrow</div>
    <div style={styles.srGuideItem}><span style={styles.srBadgeGreen}>Know It</span> Interval grows: 2 days → 4 days → more</div>
    <div style={styles.srGuideItem}><span style={styles.srBadgeBlue}>Mastered</span> Long interval: 7 days → weeks → months</div>
    <p style={styles.srGuideText}>
      <strong>You only see cards when you're about to forget them</strong> — so you don't waste time on cards you already know well. Each day you'll have fewer reviews as cards move to longer intervals.
    </p>
    <p style={styles.srGuideTip}>
      💡 <strong>Tips:</strong> Be honest with your ratings • Study daily to build streaks • Focus extra effort on "Again" cards
    </p>
  </div>
);

const LearnMode: React.FC<LearnModeProps> = ({ set, onExit, onComplete }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showCongrats, setShowCongrats] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedSession, setSavedSession] = useState<SavedSession | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [isReversed, setIsReversed] = useState(false);
  const [nothingDueToday, setNothingDueToday] = useState(false);
  const [nextDueDate, setNextDueDate] = useState<number | null>(null);
  const [showSRGuide, setShowSRGuide] = useState(false);
  // When a multiple-choice card is answered wrong we defer handleNext to the
  // explicit "Next" button click; this flag carries the re-queue decision across.
  const [requeueCurrentCard, setRequeueCurrentCard] = useState(false);

  useEffect(() => {
    // Check for saved session
    const saved = loadSavedSession();
    if (saved && saved.setId === set.id) {
      setSavedSession(saved);
      setShowResumePrompt(true);
    } else {
      setShowSetup(true);
    }

    // Save session on unmount (when navigating away)
    return () => {
      saveCurrentSession();
      audioService.stop(); // Stop audio when leaving
    };
  }, []);

  useEffect(() => {
    // Auto-save session whenever state changes
    if (questions.length > 0 && !showCongrats) {
      saveCurrentSession();
    }
  }, [currentIndex, correctCount, questions]);

  const loadSavedSession = (): SavedSession | null => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return null;
      
      const session: SavedSession = JSON.parse(saved);
      
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

  const saveCurrentSession = () => {
    if (questions.length === 0 || showCongrats) return;
    
    try {
      const session: SavedSession = {
        setId: set.id,
        questions,
        currentIndex,
        correctCount,
        timestamp: Date.now(),
        isReversed
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const clearSavedSession = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  };

  const handleResumeSession = () => {
    if (savedSession) {
      setQuestions(savedSession.questions);
      setCurrentIndex(savedSession.currentIndex);
      setCorrectCount(savedSession.correctCount);
      setIsReversed(savedSession.isReversed ?? false);
      setShowResumePrompt(false);
    }
  };

  const handleStartNewSession = () => {
    clearSavedSession();
    setShowResumePrompt(false);
    setShowSetup(true);
  };

  const initializeSession = (reversed: boolean = false, studyAll: boolean = false) => {
    const now = Date.now();
    const reviewDataMap = new Map<string, CardReviewData>(
      getSetReviewData(set.id).map((r: CardReviewData) => [r.cardId, r])
    );

    let selectedCards: Flashcard[];

    if (studyAll) {
      // Bypass spaced repetition — show all cards shuffled
      selectedCards = [...set.cards].sort(() => Math.random() - 0.5).slice(0, SESSION_SIZE);
      setNothingDueToday(false);
    } else {
      // Spaced repetition: only show due and new cards
      const dueCards: Flashcard[] = [];
      const newCards: Flashcard[] = [];

      for (const card of set.cards) {
        const reviewData = reviewDataMap.get(card.id);
        if (!reviewData) {
          newCards.push(card);
        } else if (reviewData.nextReview <= now) {
          dueCards.push(card);
        }
        // Cards not due are intentionally skipped
      }

      const shuffledDue = [...dueCards].sort(() => Math.random() - 0.5);
      const shuffledNew = [...newCards]
        .sort(() => Math.random() - 0.5)
        .slice(0, MAX_NEW_CARDS_PER_SESSION);

      selectedCards = [...shuffledDue, ...shuffledNew].slice(0, SESSION_SIZE);

      if (selectedCards.length === 0) {
        // Find the next due date so we can tell the user when to return
        let earliest: number | null = null;
        for (const reviewData of reviewDataMap.values()) {
          if (reviewData.nextReview > now) {
            if (earliest === null || reviewData.nextReview < earliest) {
              earliest = reviewData.nextReview;
            }
          }
        }
        setNextDueDate(earliest);
        setNothingDueToday(true);
        return;
      }
    }

    setNothingDueToday(false);

    // Select up to SESSION_SIZE cards
    const sessionSize = selectedCards.length;

    // Generate questions with mixed types
    const generatedQuestions: Question[] = selectedCards.map((card, index) => {
      // Adaptive difficulty: easier questions first
      let questionType: QuestionType;
      const progress = index / sessionSize;
      
      if (progress < 0.3) {
        questionType = 'multiple-choice';
      } else if (progress < 0.7) {
        questionType = Math.random() > 0.5 ? 'flashcard' : 'type-in';
      } else {
        questionType = 'type-in';
      }

      const question: Question = {
        card,
        type: questionType
      };

      // Generate distractors for multiple choice
      if (questionType === 'multiple-choice') {
        // When reversed: question = back (English), options = front (Japanese)
        const correctAnswer = reversed ? card.front : card.back;
        const otherCards = set.cards.filter(c => c.id !== card.id);
        const distractors = otherCards
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map(c => reversed ? c.front : c.back);
        
        const allOptions = [correctAnswer, ...distractors]
          .sort(() => Math.random() - 0.5);
        
        question.options = allOptions;
      }

      return question;
    });

    setQuestions(generatedQuestions);
  };

  const currentQuestion = questions[currentIndex];

  /** Return the card's persisted status, defaulting to 'learning' for new (unseen) cards. */
  const getCardStatus = (cardId: string): 'learning' | 'reviewing' | 'mastered' => {
    const found = getSetReviewData(set.id).find(d => d.cardId === cardId);
    return (found?.status ?? 'learning') as 'learning' | 'reviewing' | 'mastered';
  };

  // Helper to extract main and example text safely
  const getCardTextParts = (text: string, legacyExample?: string) => {
    if (!text) return { main: '', example: legacyExample || '' };
    const parts = text.split('\n');
    return {
      main: parts[0].trim(),
      example: parts.length > 1 ? parts.slice(1).join('\n').trim() : (legacyExample || '')
    };
  };

  const playAudio = async (text: string, legacyExample?: string) => {
    if (isPlayingAudio || !text || !audioService.isSupported()) return;
    
    try {
      setIsPlayingAudio(true);
      
      const { main, example } = getCardTextParts(text, legacyExample);
      const sequence: { text: string; pauseAfter: number }[] = [];

      // Handle Kanji[kana] format for better TTS
      const bracketMatch = main.match(/^(.*?)\[(.*?)\]/);
      if (bracketMatch) {
        const kanji = bracketMatch[1].trim();
        const kana = bracketMatch[2].trim();
        // Read both with a pause if they're different
        if (kanji !== kana && kanji && kana) {
          sequence.push({ text: kanji, pauseAfter: 1000 });
          sequence.push({ text: kana, pauseAfter: example ? 1500 : 0 });
        } else {
          sequence.push({ text: kanji || kana, pauseAfter: example ? 1500 : 0 });
        }
      } else {
        // Remove markdown or other brackets if any exist
        const cleanText = main.replace(/\[.*?\]/g, '').trim();
        sequence.push({ text: cleanText, pauseAfter: example ? 1500 : 0 });
      }

      if (example) {
        sequence.push({ text: example.replace(/\[.*?\]/g, '').trim(), pauseAfter: 0 });
      }

      await audioService.playSequence(sequence);
      
    } catch (error) {
      console.error('Audio playback error:', error);
    } finally {
      setIsPlayingAudio(false);
    }
  };

  const handleMultipleChoiceSelect = (option: string) => {
    if (showAnswer) return;
    
    setSelectedOption(option);
    const correctAnswer = isReversed ? currentQuestion.card.front : currentQuestion.card.back;
    const correct = option === correctAnswer;
    setIsCorrect(correct);
    setShowAnswer(true);
    
    if (correct) {
      setCorrectCount(correctCount + 1);
      // Record as "Know It" in spaced repetition
      saveCardReview(set.id, currentQuestion.card.id, 'know_it');
      // requeueCurrentCard is already false (or will be reset by handleNext)
    } else {
      // Check status BEFORE saving so we know whether to re-queue
      const wasLearning = getCardStatus(currentQuestion.card.id) === 'learning';
      // Record as "Again" in spaced repetition
      saveCardReview(set.id, currentQuestion.card.id, 'again');
      setRequeueCurrentCard(wasLearning);
    }
  };

  const handleTypeInSubmit = () => {
    if (showAnswer) return;
    
    const answerField = isReversed ? currentQuestion.card.front : currentQuestion.card.back;
    const { main: expectedAnswer } = getCardTextParts(answerField);
    
    // Use the 3-tier flexible matching system
    const result = checkAnswerWithDetails(userAnswer, expectedAnswer);
    setMatchResult(result);
    setIsCorrect(result.isCorrect);
    setShowAnswer(true);
    
    if (result.isCorrect) {
      setCorrectCount(correctCount + 1);
      saveCardReview(set.id, currentQuestion.card.id, 'know_it');
    } else {
      // Don't record yet - let user decide with override button
    }
  };

  const handleTypeInOverride = () => {
    // User says their answer was correct
    setIsCorrect(true);
    setCorrectCount(correctCount + 1);
    saveCardReview(set.id, currentQuestion.card.id, 'know_it');
    // Now advance to next card
    handleNext();
  };

  const handleTypeInConfirmWrong = () => {
    // User confirms their answer was wrong
    const wasLearning = getCardStatus(currentQuestion.card.id) === 'learning';
    saveCardReview(set.id, currentQuestion.card.id, 'again');
    handleNext(wasLearning);
  };

  const handleFlashcardRate = (rating: ReviewRating) => {
    const wasLearning = rating === 'again' && getCardStatus(currentQuestion.card.id) === 'learning';
    saveCardReview(set.id, currentQuestion.card.id, rating);
    
    if (rating === 'know_it' || rating === 'mastered') {
      setCorrectCount(correctCount + 1);
    }
    
    handleNext(wasLearning);
  };

  const handleNext = (requeueCurrent = false) => {
    audioService.stop(); // Stop any playing audio before proceeding

    // Re-queue learning cards that were answered 'again' by appending them to
    // the end of the question list. The effective length grows by 1 so we
    // must account for that when deciding whether the session is complete.
    let extraLen = 0;
    if (requeueCurrent && currentQuestion) {
      extraLen = 1;
      setQuestions(prev => [...prev, { ...currentQuestion }]);
    }
    setRequeueCurrentCard(false);

    const effectiveLength = questions.length + extraLen;

    if (currentIndex < effectiveLength - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
      setIsCorrect(null);
      setMatchResult(null);
      setUserAnswer('');
      setSelectedOption(null);
    } else {
      setShowCongrats(true);
      clearSavedSession(); // Clear saved session on completion
    }
  };

  // Determine if the Next button should be shown
  const shouldShowNextButton = () => {
    if (!showAnswer || currentQuestion.type === 'flashcard') return false;
    if (currentQuestion.type === 'multiple-choice') return true;
    if (currentQuestion.type === 'type-in' && isCorrect) return true;
    return false; // Type-in wrong state has its own override buttons
  };

  // Get match confidence indicator for UI
  const getMatchConfidenceIndicator = () => {
    if (!matchResult || !showAnswer) return null;
    
    switch (matchResult.matchType) {
      case 'exact':
        return '✓ Perfect match!';
      case 'part':
        return '✓ Partial match (accepted)';
      case 'word':
        return '✓ Key word match (accepted)';
      default:
        return null;
    }
  };

  // Resume prompt screen
  if (showResumePrompt && savedSession) {
    const progress = Math.round((savedSession.currentIndex / savedSession.questions.length) * 100);
    
    return (
      <div style={styles.resumeContainer}>
        <div style={styles.resumeCard}>
          <div style={styles.resumeIcon}>📚</div>
          <h2 style={styles.resumeTitle}>Resume Session?</h2>
          <p style={styles.resumeText}>
            You have an in-progress session from earlier.
          </p>
          <div style={styles.resumeStats}>
            <div style={styles.resumeStatItem}>
              <span style={styles.resumeStatValue}>{savedSession.currentIndex + 1}/{savedSession.questions.length}</span>
              <span style={styles.resumeStatLabel}>Cards Completed</span>
            </div>
            <div style={styles.resumeStatItem}>
              <span style={styles.resumeStatValue}>{progress}%</span>
              <span style={styles.resumeStatLabel}>Progress</span>
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
    );
  }

  // Setup screen — shown before each new session
  if (showSetup) {
    const now = Date.now();
    const reviewDataMap = new Map<string, CardReviewData>(
      getSetReviewData(set.id).map((r: CardReviewData) => [r.cardId, r])
    );
    const dueCount = set.cards.filter(c => {
      const r = reviewDataMap.get(c.id);
      return r && r.nextReview <= now;
    }).length;
    const newCount = set.cards.filter(c => !reviewDataMap.get(c.id)).length;
    const sessionCount = Math.min(SESSION_SIZE, dueCount + Math.min(newCount, MAX_NEW_CARDS_PER_SESSION));

    return (
      <div style={styles.setupContainer}>
        <div style={styles.setupCard}>
          <div style={styles.setupTopRow}>
            <button style={styles.exitButton} onClick={onExit}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >← Back</button>
            <h2 style={styles.setupTitle}>Learn Mode</h2>
            <div style={{ width: 60 }} />
          </div>

          {/* Today's stats */}
          <div style={styles.setupStats}>
            <div style={styles.setupStatItem}>
              <span style={styles.setupStatValue}>{dueCount}</span>
              <span style={styles.setupStatLabel}>Due for review</span>
            </div>
            <div style={styles.setupStatItem}>
              <span style={styles.setupStatValue}>{newCount}</span>
              <span style={styles.setupStatLabel}>New cards</span>
            </div>
            <div style={styles.setupStatItem}>
              <span style={{ ...styles.setupStatValue, color: '#3b82f6' }}>{sessionCount}</span>
              <span style={styles.setupStatLabel}>This session</span>
            </div>
          </div>

          {/* Direction toggle */}
          <div style={styles.setupSection}>
            <h3 style={styles.setupSectionTitle}>Question Direction</h3>
            <div style={styles.directionToggle}>
              <button
                style={{ ...styles.directionButton, ...(isReversed ? {} : styles.directionButtonActive) }}
                onClick={() => setIsReversed(false)}
              >
                Front → Back
              </button>
              <button
                style={{ ...styles.directionButton, ...(isReversed ? styles.directionButtonActive : {}) }}
                onClick={() => setIsReversed(true)}
              >
                Back → Front
              </button>
            </div>
          </div>

          {/* SR Guide toggle */}
          <div style={styles.setupSection}>
            <button
              style={styles.srGuideToggle}
              onClick={() => setShowSRGuide(prev => !prev)}
            >
              {showSRGuide ? '▲' : '▼'} How does the review system work?
            </button>
            {showSRGuide && <SRGuideContent />}
          </div>

          {/* Start buttons */}
          <button
            style={{ ...styles.primaryButton, width: '100%', marginBottom: '12px' }}
            onClick={() => { setShowSetup(false); initializeSession(isReversed); }}
            disabled={sessionCount === 0}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {sessionCount === 0 ? '✅ Nothing due today' : `▶️ Start Session (${sessionCount} cards)`}
          </button>
          {sessionCount === 0 && (
            <button
              style={{ ...styles.secondaryButton, width: '100%' }}
              onClick={() => { setShowSetup(false); initializeSession(isReversed, true); }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              📚 Study All Cards Anyway
            </button>
          )}
        </div>
      </div>
    );
  }

  if (nothingDueToday) {
    return (
      <div style={styles.setupContainer}>
        <div style={styles.setupCard}>
          <div style={styles.congratsIcon}>✅</div>
          <h2 style={styles.congratsTitle}>You're all caught up!</h2>
          <p style={{ color: '#64748b', marginBottom: '8px', textAlign: 'center' }}>
            All your cards have been reviewed. Come back when cards are due again.
          </p>
          {nextDueDate && (
            <p style={{ color: '#3b82f6', fontWeight: 600, marginBottom: '24px', textAlign: 'center' }}>
              Next review: {new Date(nextDueDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
          )}

          {/* SR Guide */}
          <div style={styles.setupSection}>
            <button
              style={styles.srGuideToggle}
              onClick={() => setShowSRGuide(prev => !prev)}
            >
              {showSRGuide ? '▲' : '▼'} How does the review system work?
            </button>
            {showSRGuide && <SRGuideContent />}
          </div>

          <button
            style={{ ...styles.secondaryButton, width: '100%', marginBottom: '12px' }}
            onClick={() => { setNothingDueToday(false); setShowSetup(false); initializeSession(isReversed, true); }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            📚 Study All Cards Anyway
          </button>
          <button
            style={{ ...styles.exitButton, display: 'block', margin: '0 auto' }}
            onClick={onExit}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div style={styles.loading}>
        <p>No cards available in this deck.</p>
        <button style={styles.exitButtonStandalone} onClick={onExit}>← Go Back</button>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / questions.length) * 100;

  if (showCongrats) {
    const accuracy = Math.round((correctCount / questions.length) * 100);
    
    return (
      <div style={styles.congratsContainer}>
        <div style={styles.congratsCard}>
          <div style={styles.congratsIcon}>🎉</div>
          <h2 style={styles.congratsTitle}>Session Complete!</h2>
          <div style={styles.congratsStats}>
            <div style={styles.statItem}>
              <div style={styles.statValue}>{correctCount}/{questions.length}</div>
              <div style={styles.statLabel}>Correct Answers</div>
            </div>
            <div style={styles.statItem}>
              <div style={styles.statValue}>{accuracy}%</div>
              <div style={styles.statLabel}>Accuracy</div>
            </div>
          </div>
          <div style={styles.congratsButtons}>
            <button
              style={styles.primaryButton}
              onClick={() => {
                setShowCongrats(false);
                setCurrentIndex(0);
                setCorrectCount(0);
                initializeSession(isReversed);
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              🔄 Start New Session
            </button>
            <button
              style={styles.secondaryButton}
              onClick={onComplete}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              ✓ Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Swap question/answer based on direction
  const questionParts = isReversed
    ? getCardTextParts(currentQuestion.card.back)
    : getCardTextParts(currentQuestion.card.front, currentQuestion.card.example);
  const answerParts = isReversed
    ? getCardTextParts(currentQuestion.card.front, currentQuestion.card.example)
    : getCardTextParts(currentQuestion.card.back);
  const questionAudioField = isReversed ? currentQuestion.card.back : currentQuestion.card.front;
  const questionAudioExample = isReversed ? undefined : currentQuestion.card.example;
  const answerAudioField = isReversed ? currentQuestion.card.front : currentQuestion.card.back;
  const correctAnswerField = isReversed ? currentQuestion.card.front : currentQuestion.card.back;

  return (
    <div style={styles.container}>
      {/* Header with progress */}
      <div style={styles.header}>
        <button
          style={styles.exitButton}
          onClick={onExit}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          ← Exit
        </button>
        <div style={styles.progressInfo}>
          <span style={{ fontSize: '12px', color: '#94a3b8', marginRight: '8px' }}>
            {isReversed ? '🇬🇧→🇯🇵' : '🇯🇵→🇬🇧'}
          </span>
          <span style={styles.progressText}>
            {currentIndex + 1} / {questions.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={styles.progressBarContainer}>
        <div style={{ ...styles.progressBar, width: `${progress}%` }} />
      </div>

      {/* Question card */}
      <div style={styles.questionCard}>
        {/* Question prompt with audio */}
        <div style={styles.questionPrompt}>
          <div style={styles.questionFrontRow}>
            <div style={styles.questionFront}>{questionParts.main}</div>
            <button
              style={styles.audioButton}
              onClick={() => playAudio(questionAudioField, questionAudioExample)}
              disabled={isPlayingAudio}
              title="Play audio"
              onMouseEnter={(e) => !isPlayingAudio && (e.currentTarget.style.transform = 'scale(1.1)')}
              onMouseLeave={(e) => !isPlayingAudio && (e.currentTarget.style.transform = 'scale(1)')}
            >
              {isPlayingAudio ? '🔊' : '🔈'}
            </button>
          </div>
          {questionParts.example && (
            <div style={styles.questionExampleRow}>
              <div style={styles.questionExample}>
                例文: {questionParts.example}
              </div>
            </div>
          )}
        </div>

        {/* Multiple Choice */}
        {currentQuestion.type === 'multiple-choice' && (
          <div style={styles.optionsContainer}>
            {currentQuestion.options?.map((option, idx) => {
              const isSelected = selectedOption === option;
              const isCorrectOption = option === correctAnswerField;
              const optionParts = getCardTextParts(option);
              
              let buttonStyle = styles.optionButton;
              if (showAnswer) {
                if (isCorrectOption) {
                  buttonStyle = { ...buttonStyle, ...styles.optionCorrect };
                } else if (isSelected && !isCorrectOption) {
                  buttonStyle = { ...buttonStyle, ...styles.optionWrong };
                }
              } else if (isSelected) {
                buttonStyle = { ...buttonStyle, ...styles.optionSelected };
              }

              return (
                <button
                  key={idx}
                  style={buttonStyle}
                  onClick={() => handleMultipleChoiceSelect(option)}
                  disabled={showAnswer}
                  onMouseEnter={(e) => !showAnswer && (e.currentTarget.style.transform = 'scale(1.02)')}
                  onMouseLeave={(e) => !showAnswer && (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <div style={{ fontWeight: 600 }}>{optionParts.main}</div>
                  {optionParts.example && (
                    <div style={{ fontSize: '14px', marginTop: '6px', color: 'inherit', fontWeight: 400 }}>
                      {optionParts.example}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Type-in */}
        {currentQuestion.type === 'type-in' && (
          <div style={styles.typeInContainer}>
            <input
              type="text"
              style={styles.typeInInput}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !showAnswer && handleTypeInSubmit()}
              placeholder={isReversed ? 'Type Japanese...' : 'Type English meaning...'}
              disabled={showAnswer}
              autoFocus
            />
            {!showAnswer && (
              <button
                style={styles.submitButton}
                onClick={handleTypeInSubmit}
                disabled={!userAnswer.trim()}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Check Answer
              </button>
            )}
            {showAnswer && (
              <div style={styles.feedbackContainer}>
                <div style={isCorrect ? styles.feedbackCorrect : styles.feedbackWrong}>
                  {isCorrect ? (
                    <>
                      {getMatchConfidenceIndicator()}
                      {matchResult && matchResult.matchType !== 'exact' && (
                        <div style={{ fontSize: '14px', marginTop: '4px', opacity: 0.8 }}>
                          Expected: {answerParts.main}
                        </div>
                      )}
                    </>
                  ) : (
                    `✗ Expected: ${answerParts.main}`
                  )}
                </div>
                {!isCorrect && (
                  <div style={styles.overrideButtons}>
                    <button
                      style={styles.overrideCorrectButton}
                      onClick={handleTypeInOverride}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                      ✓ My answer was correct
                    </button>
                    <button
                      style={styles.overrideWrongButton}
                      onClick={handleTypeInConfirmWrong}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                      ✗ No, I was wrong
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Flashcard */}
        {currentQuestion.type === 'flashcard' && (
          <div style={styles.flashcardContainer}>
            {!showAnswer ? (
              <button
                style={styles.showAnswerButton}
                onClick={() => setShowAnswer(true)}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Show Answer
              </button>
            ) : (
              <>
                <div style={styles.flashcardAnswerRow}>
                  <div style={styles.flashcardAnswerContainer}>
                    <div style={styles.flashcardAnswer}>{answerParts.main}</div>
                    {answerParts.example && (
                      <div style={styles.questionExample}>
                        Example: {answerParts.example}
                      </div>
                    )}
                  </div>
                  <button
                    style={styles.audioButton}
                    onClick={() => playAudio(answerAudioField)}
                    disabled={isPlayingAudio}
                    title="Play answer audio"
                    onMouseEnter={(e) => !isPlayingAudio && (e.currentTarget.style.transform = 'scale(1.1)')}
                    onMouseLeave={(e) => !isPlayingAudio && (e.currentTarget.style.transform = 'scale(1)')}
                  >
                    {isPlayingAudio ? '🔊' : '🔈'}
                  </button>
                </div>
                <div style={styles.ratingButtons}>
                  <button
                    style={{ ...styles.ratingButton, ...styles.ratingAgain }}
                    onClick={() => handleFlashcardRate('again')}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    Again
                  </button>
                  <button
                    style={{ ...styles.ratingButton, ...styles.ratingGood }}
                    onClick={() => handleFlashcardRate('know_it')}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    Know It
                  </button>
                  <button
                    style={{ ...styles.ratingButton, ...styles.ratingEasy }}
                    onClick={() => handleFlashcardRate('mastered')}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    Mastered
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Next button */}
        {shouldShowNextButton() && (
          <button
            style={styles.nextButton}
            onClick={() => handleNext(requeueCurrentCard)}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {currentIndex < questions.length - 1 || requeueCurrentCard ? 'Next →' : 'Finish'}
          </button>
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    padding: '24px'
  },
  loading: {
    textAlign: 'center',
    padding: '100px 20px',
    fontSize: '18px',
    color: '#64748b',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px'
  },
  exitButtonStandalone: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  header: {
    maxWidth: '800px',
    margin: '0 auto 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  exitButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#64748b',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '8px 16px',
    transition: 'opacity 0.2s'
  },
  progressInfo: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#0f172a'
  },
  progressText: {},
  progressBarContainer: {
    maxWidth: '800px',
    margin: '0 auto 32px',
    height: '8px',
    backgroundColor: '#e2e8f0',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    transition: 'width 0.3s ease'
  },
  questionCard: {
    maxWidth: '800px',
    margin: '0 auto',
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '40px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
  },
  questionPrompt: {
    marginBottom: '32px'
  },
  questionFrontRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginBottom: '16px'
  },
  questionFront: {
    fontSize: '28px',
    fontWeight: 600,
    color: '#0f172a',
    textAlign: 'center'
  },
  questionExampleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px'
  },
  questionExample: {
    fontSize: '16px',
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center'
  },
  audioButton: {
    backgroundColor: '#f1f5f9',
    border: '2px solid #cbd5e1',
    borderRadius: '50%',
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '20px',
    transition: 'all 0.2s',
    flexShrink: 0
  },
  optionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px'
  },
  optionButton: {
    padding: '16px 24px',
    fontSize: '18px',
    backgroundColor: '#f8fafc',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left',
    display: 'flex',
    flexDirection: 'column'
  },
  optionSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6'
  },
  optionCorrect: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
    cursor: 'default'
  },
  optionWrong: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    cursor: 'default'
  },
  typeInContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  typeInInput: {
    padding: '16px',
    fontSize: '18px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  submitButton: {
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
  feedbackContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  feedbackCorrect: {
    padding: '16px',
    backgroundColor: '#d1fae5',
    borderRadius: '12px',
    color: '#065f46',
    fontSize: '16px',
    fontWeight: 600,
    textAlign: 'center'
  },
  feedbackWrong: {
    padding: '16px',
    backgroundColor: '#fee2e2',
    borderRadius: '12px',
    color: '#991b1b',
    fontSize: '16px',
    fontWeight: 600,
    textAlign: 'center'
  },
  overrideButtons: {
    display: 'flex',
    gap: '12px'
  },
  overrideCorrectButton: {
    flex: 1,
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  overrideWrongButton: {
    flex: 1,
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  flashcardContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px'
  },
  showAnswerButton: {
    padding: '16px 48px',
    fontSize: '18px',
    fontWeight: 600,
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  flashcardAnswerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginBottom: '8px',
    width: '100%'
  },
  flashcardAnswerContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
  },
  flashcardAnswer: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#0f172a',
    textAlign: 'center'
  },
  ratingButtons: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  ratingButton: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    color: 'white',
    transition: 'opacity 0.2s'
  },
  ratingAgain: {
    backgroundColor: '#ef4444'
  },
  ratingGood: {
    backgroundColor: '#10b981'
  },
  ratingEasy: {
    backgroundColor: '#3b82f6'
  },
  nextButton: {
    width: '100%',
    padding: '16px 32px',
    fontSize: '16px',
    fontWeight: 600,
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    marginTop: '24px',
    transition: 'opacity 0.2s'
  },
  resumeContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
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
  congratsContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: '24px'
  },
  congratsCard: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '48px',
    maxWidth: '500px',
    textAlign: 'center',
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
  },
  congratsIcon: {
    fontSize: '64px',
    marginBottom: '24px'
  },
  congratsTitle: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '32px'
  },
  congratsStats: {
    display: 'flex',
    gap: '48px',
    justifyContent: 'center',
    marginBottom: '32px'
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  statValue: {
    fontSize: '36px',
    fontWeight: 700,
    color: '#3b82f6'
  },
  statLabel: {
    fontSize: '14px',
    color: '#64748b',
    fontWeight: 500
  },
  congratsButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap'
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
  // Setup screen styles
  setupContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: '24px'
  },
  setupCard: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '32px',
    maxWidth: '520px',
    width: '100%',
    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
    marginTop: '24px'
  },
  setupTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  setupTitle: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0
  },
  setupStats: {
    display: 'flex',
    gap: '0',
    justifyContent: 'space-around',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '24px',
    border: '1px solid #e2e8f0'
  },
  setupStatItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '4px'
  },
  setupStatValue: {
    fontSize: '26px',
    fontWeight: 700,
    color: '#0f172a'
  },
  setupStatLabel: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: 500
  },
  setupSection: {
    marginBottom: '20px'
  },
  setupSectionTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#475569',
    marginBottom: '10px',
    margin: '0 0 10px 0'
  },
  directionToggle: {
    display: 'flex',
    gap: '8px'
  },
  directionButton: {
    flex: 1,
    padding: '10px 12px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  directionButtonActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#3b82f6',
    color: '#1d4ed8'
  },
  srGuideToggle: {
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0',
    textAlign: 'left' as const
  },
  srGuideContent: {
    marginTop: '12px',
    padding: '16px',
    backgroundColor: '#f0f9ff',
    borderRadius: '12px',
    border: '1px solid #bae6fd'
  },
  srGuideText: {
    fontSize: '13px',
    color: '#0f172a',
    lineHeight: 1.6,
    margin: '0 0 12px 0'
  },
  srGuideItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#334155',
    marginBottom: '6px'
  },
  srGuideTip: {
    fontSize: '13px',
    color: '#0369a1',
    lineHeight: 1.6,
    margin: '12px 0 0 0'
  },
  srBadgeRed: {
    backgroundColor: '#ef4444',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0
  },
  srBadgeGreen: {
    backgroundColor: '#10b981',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0
  },
  srBadgeBlue: {
    backgroundColor: '#3b82f6',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 700,
    flexShrink: 0
  }
};

export default LearnMode;

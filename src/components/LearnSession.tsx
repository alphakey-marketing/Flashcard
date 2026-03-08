import React, { useState, useEffect, CSSProperties } from 'react';
import { Flashcard, FlashcardSet } from '../lib/storage';
import { getCardReview, recordReview } from '../lib/spacedRepetition';
import { QuestionType, LearnQuestion, LearnSessionProgress, LearnSessionResult } from '../types/learnSession';

interface LearnSessionProps {
  set: FlashcardSet;
  onComplete: (result: LearnSessionResult) => void;
  onExit: () => void;
}

const LearnSession: React.FC<LearnSessionProps> = ({ set, onComplete, onExit }) => {
  const [questions, setQuestions] = useState<LearnQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [sessionStartTime] = useState(Date.now());
  const [progress, setProgress] = useState<LearnSessionProgress>({
    totalQuestions: 0,
    completedQuestions: 0,
    correctCount: 0,
    incorrectCount: 0
  });
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    console.log('[LearnSession] Version: 2026-03-08-v2 with flexible matching');
    initializeSession();
  }, []);

  const initializeSession = () => {
    // Select cards for this session (up to 20)
    const sessionCards = selectSessionCards(set.cards);
    const generatedQuestions = generateQuestions(sessionCards);
    
    setQuestions(generatedQuestions);
    setProgress({
      totalQuestions: generatedQuestions.length,
      completedQuestions: 0,
      correctCount: 0,
      incorrectCount: 0
    });
  };

  const selectSessionCards = (cards: Flashcard[]): Flashcard[] => {
    // Get card reviews to determine difficulty
    const cardsWithStats = cards.map(card => {
      const review = getCardReview(card.id, set.id);
      return { card, review };
    });

    // Prioritize: new cards > struggling cards > due cards
    const prioritized = cardsWithStats.sort((a, b) => {
      const aNew = !a.review || a.review.repetitions === 0;
      const bNew = !b.review || b.review.repetitions === 0;
      
      if (aNew && !bNew) return -1;
      if (!aNew && bNew) return 1;
      
      // Sort struggling cards (low ease factor) first
      const aEase = a.review?.easeFactor || 2.5;
      const bEase = b.review?.easeFactor || 2.5;
      return aEase - bEase;
    });

    return prioritized.slice(0, 20).map(p => p.card);
  };

  const generateQuestions = (cards: Flashcard[]): LearnQuestion[] => {
    const questions: LearnQuestion[] = [];
    
    cards.forEach((card, index) => {
      const review = getCardReview(card.id, set.id);
      const isNew = !review || review.repetitions === 0;
      const isStruggling = review && review.easeFactor < 2.0;

      // Adaptive question type selection
      let questionType: QuestionType;
      
      if (isNew) {
        // New cards: start with multiple choice (easier)
        questionType = index % 2 === 0 ? 'multiple-choice' : 'flashcard';
      } else if (isStruggling) {
        // Struggling cards: more practice with type-in
        questionType = 'type-in';
      } else {
        // Regular cards: mix of all types
        const types: QuestionType[] = ['multiple-choice', 'type-in', 'flashcard'];
        questionType = types[index % types.length];
      }

      questions.push(createQuestion(card, questionType, cards));
    });

    return questions;
  };

  const createQuestion = (card: Flashcard, type: QuestionType, allCards: Flashcard[]): LearnQuestion => {
    const question: LearnQuestion = {
      id: `${card.id}-${type}`,
      card,
      type,
      prompt: '',
      correctAnswer: '',
      attempts: 0
    };

    if (type === 'multiple-choice') {
      question.prompt = `What is the meaning of "${card.front}"?`;
      question.correctAnswer = card.back;
      question.options = generateMultipleChoiceOptions(card, allCards);
    } else if (type === 'type-in') {
      question.prompt = `Type the meaning of "${card.front}"`;
      question.correctAnswer = card.back;
    } else {
      question.prompt = card.front;
      question.correctAnswer = card.back;
    }

    return question;
  };

  const generateMultipleChoiceOptions = (correctCard: Flashcard, allCards: Flashcard[]) => {
    const options = [{ id: correctCard.id, text: correctCard.back, isCorrect: true }];
    
    // Get 3 wrong options from other cards
    const otherCards = allCards.filter(c => c.id !== correctCard.id);
    const shuffled = otherCards.sort(() => Math.random() - 0.5);
    
    shuffled.slice(0, 3).forEach(card => {
      options.push({ id: card.id, text: card.back, isCorrect: false });
    });

    return options.sort(() => Math.random() - 0.5);
  };

  const handleMultipleChoiceAnswer = (optionId: string) => {
    const currentQuestion = questions[currentIndex];
    const selectedOption = currentQuestion.options?.find(o => o.id === optionId);
    
    if (!selectedOption) return;

    const isCorrect = selectedOption.isCorrect;
    recordAnswer(isCorrect);
  };

  const normalizeAnswer = (text: string): string => {
    return text.toLowerCase().trim().replace(/[.,!?;:]/g, '');
  };

  const isTypeInCorrect = (userAnswer: string, correctAnswer: string): boolean => {
    const normalizedUser = normalizeAnswer(userAnswer);
    const normalizedCorrect = normalizeAnswer(correctAnswer);

    console.log('[Answer Check] User:', userAnswer, '-> normalized:', normalizedUser);
    console.log('[Answer Check] Correct:', correctAnswer, '-> normalized:', normalizedCorrect);

    if (!normalizedUser) return false;

    // 1) Exact match
    if (normalizedUser === normalizedCorrect) {
      console.log('[Answer Check] ✓ Exact match');
      return true;
    }

    // 2) Split correct answer into parts by common separators
    const parts = correctAnswer
      .split(/[,/、／;]/)
      .map(p => normalizeAnswer(p))
      .filter(Boolean);

    console.log('[Answer Check] Parts:', parts);

    // Check if user answer matches one full part
    if (parts.includes(normalizedUser)) {
      console.log('[Answer Check] ✓ Part match');
      return true;
    }

    // 3) Word-level match: check if user's answer contains at least one meaningful word from correct answer
    const stopWords = new Set(['to', 'a', 'an', 'the', 'of', 'and', 'or', 'in', 'on', 'at', 'for', 'with']);
    
    // Get all meaningful words from all parts
    const correctWords = parts
      .flatMap(p => p.split(/\s+/))
      .map(w => w.trim())
      .filter(w => w.length >= 2 && !stopWords.has(w));

    console.log('[Answer Check] Correct words:', correctWords);

    // Check if user input contains any of these words as whole words
    const hasWordMatch = correctWords.some(word => {
      const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const wordBoundaryRegex = new RegExp(`\\b${escapedWord}\\b`, 'i');
      return wordBoundaryRegex.test(normalizedUser);
    });

    if (hasWordMatch) {
      console.log('[Answer Check] ✓ Word match');
    } else {
      console.log('[Answer Check] ✗ No match');
    }

    return hasWordMatch;
  };

  const handleTypeInSubmit = () => {
    if (!userInput.trim()) return;

    const currentQuestion = questions[currentIndex];
    const isCorrect = isTypeInCorrect(userInput, currentQuestion.correctAnswer);
    
    console.log('[Submit] Final result:', isCorrect ? 'CORRECT' : 'INCORRECT');
    
    recordAnswer(isCorrect);
  };

  const handleFlashcardAnswer = (quality: 'again' | 'hard' | 'good' | 'easy') => {
    const isCorrect = quality === 'good' || quality === 'easy';
    recordAnswer(isCorrect, quality);
  };

  const recordAnswer = (isCorrect: boolean, quality: 'again' | 'hard' | 'good' | 'easy' = 'good') => {
    const currentQuestion = questions[currentIndex];
    
    // Update spaced repetition system
    recordReview(currentQuestion.card.id, set.id, quality);

    // Update progress
    setProgress(prev => ({
      ...prev,
      completedQuestions: prev.completedQuestions + 1,
      correctCount: prev.correctCount + (isCorrect ? 1 : 0),
      incorrectCount: prev.incorrectCount + (isCorrect ? 0 : 1)
    }));

    // Update question
    const updatedQuestions = [...questions];
    updatedQuestions[currentIndex] = {
      ...currentQuestion,
      userAnswer: userInput,
      isCorrect,
      attempts: currentQuestion.attempts + 1
    };
    setQuestions(updatedQuestions);

    setShowAnswer(true);
    setTimeout(() => {
      if (currentIndex < questions.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setUserInput('');
        setShowAnswer(false);
      } else {
        completeSession();
      }
    }, 1500);
  };

  const completeSession = () => {
    const duration = Math.floor((Date.now() - sessionStartTime) / 1000);
    const result: LearnSessionResult = {
      totalCards: progress.totalQuestions,
      correctAnswers: progress.correctCount,
      accuracy: Math.round((progress.correctCount / progress.totalQuestions) * 100),
      duration,
      completedAt: new Date()
    };
    onComplete(result);
  };

  if (questions.length === 0) {
    return <div style={styles.loading}>Preparing your session...</div>;
  }

  const currentQuestion = questions[currentIndex];
  const progressPercent = (progress.completedQuestions / progress.totalQuestions) * 100;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.exitButton} onClick={onExit}>✕ Exit</button>
        <h2 style={styles.title}>Learn: {set.title}</h2>
        <button style={styles.tipsButton} onClick={() => setShowTips(!showTips)}>
          💡 Tips
        </button>
      </div>

      {/* Progress Bar */}
      <div style={styles.progressContainer}>
        <div style={styles.progressBar}>
          <div style={{ ...styles.progressFill, width: `${progressPercent}%` }} />
        </div>
        <span style={styles.progressText}>
          {progress.completedQuestions}/{progress.totalQuestions}
        </span>
      </div>

      {/* Learning Tips Modal */}
      {showTips && (
        <div style={styles.tipsModal}>
          <div style={styles.tipsContent}>
            <div style={styles.tipsHeader}>
              <h3 style={styles.tipsTitle}>Learning Phases Framework</h3>
              <button style={styles.closeButton} onClick={() => setShowTips(false)}>✕</button>
            </div>
            <div style={styles.tipsBody}>
              <div style={styles.phase}>
                <div style={styles.phaseHeader}>📘 Phase 1: Initial Learning (NEW cards)</div>
                <div style={styles.phaseContent}>
                  → Multiple choice (recognition)<br/>
                  → Shadow reading (if audio available)
                </div>
              </div>
              <div style={styles.phase}>
                <div style={styles.phaseHeader}>💪 Phase 2: Strengthening (LEARNING cards)</div>
                <div style={styles.phaseContent}>
                  → Typing practice (production)<br/>
                  → Standard flashcards
                </div>
              </div>
              <div style={styles.phase}>
                <div style={styles.phaseHeader}>🔄 Phase 3: Maintenance (REVIEWING cards)</div>
                <div style={styles.phaseContent}>
                  → Quick flashcard reviews<br/>
                  → Due card reminders
                </div>
              </div>
              <div style={styles.phase}>
                <div style={styles.phaseHeader}>🎓 Phase 4: Mastery (MASTERED cards)</div>
                <div style={styles.phaseContent}>
                  → Long interval reviews only<br/>
                  → Shadow reading at native speed
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Question Card */}
      <div style={styles.questionCard}>
        <div style={styles.questionType}>
          {currentQuestion.type === 'multiple-choice' && '🎯 Multiple Choice'}
          {currentQuestion.type === 'type-in' && '⌨️ Type In'}
          {currentQuestion.type === 'flashcard' && '🎴 Flashcard'}
        </div>

        <div style={styles.questionPrompt}>{currentQuestion.prompt}</div>

        {/* Multiple Choice */}
        {currentQuestion.type === 'multiple-choice' && !showAnswer && (
          <div style={styles.optionsContainer}>
            {currentQuestion.options?.map(option => (
              <button
                key={option.id}
                style={styles.optionButton}
                onClick={() => handleMultipleChoiceAnswer(option.id)}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                {option.text}
              </button>
            ))}
          </div>
        )}

        {/* Type In */}
        {currentQuestion.type === 'type-in' && !showAnswer && (
          <div style={styles.typeInContainer}>
            <input
              type="text"
              style={styles.typeInInput}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleTypeInSubmit()}
              placeholder="Type your answer..."
              autoFocus
            />
            <button
              style={styles.submitButton}
              onClick={handleTypeInSubmit}
              disabled={!userInput.trim()}
            >
              Submit
            </button>
          </div>
        )}

        {/* Flashcard */}
        {currentQuestion.type === 'flashcard' && !showAnswer && (
          <div style={styles.flashcardContainer}>
            <button
              style={styles.showAnswerButton}
              onClick={() => setShowAnswer(true)}
            >
              Show Answer
            </button>
          </div>
        )}

        {/* Show Answer After Response */}
        {showAnswer && (
          <div style={styles.answerContainer}>
            <div style={{
              ...styles.answerBadge,
              backgroundColor: currentQuestion.isCorrect ? '#10b981' : '#ef4444'
            }}>
              {currentQuestion.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
            </div>
            <div style={styles.correctAnswer}>
              <strong>Answer:</strong> {currentQuestion.correctAnswer}
            </div>
            {currentQuestion.card.example && (
              <div style={styles.example}>
                <strong>Example:</strong> {currentQuestion.card.example}
              </div>
            )}

            {/* Flashcard Quality Buttons */}
            {currentQuestion.type === 'flashcard' && (
              <div style={styles.qualityButtons}>
                <button
                  style={{ ...styles.qualityButton, backgroundColor: '#ef4444' }}
                  onClick={() => handleFlashcardAnswer('again')}
                >
                  Again
                </button>
                <button
                  style={{ ...styles.qualityButton, backgroundColor: '#f97316' }}
                  onClick={() => handleFlashcardAnswer('hard')}
                >
                  Hard
                </button>
                <button
                  style={{ ...styles.qualityButton, backgroundColor: '#10b981' }}
                  onClick={() => handleFlashcardAnswer('good')}
                >
                  Good
                </button>
                <button
                  style={{ ...styles.qualityButton, backgroundColor: '#3b82f6' }}
                  onClick={() => handleFlashcardAnswer('easy')}
                >
                  Easy
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={styles.stats}>
        <div style={styles.stat}>
          <span style={{ ...styles.statValue, color: '#10b981' }}>{progress.correctCount}</span>
          <span style={styles.statLabel}>Correct</span>
        </div>
        <div style={styles.stat}>
          <span style={{ ...styles.statValue, color: '#ef4444' }}>{progress.incorrectCount}</span>
          <span style={styles.statLabel}>Incorrect</span>
        </div>
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
  header: {
    maxWidth: '800px',
    margin: '0 auto 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  exitButton: {
    backgroundColor: '#fff',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#64748b'
  },
  title: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0
  },
  tipsButton: {
    backgroundColor: '#fff',
    border: '2px solid #3b82f6',
    borderRadius: '12px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#3b82f6'
  },
  progressContainer: {
    maxWidth: '800px',
    margin: '0 auto 32px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  progressBar: {
    flex: 1,
    height: '12px',
    backgroundColor: '#e2e8f0',
    borderRadius: '6px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    transition: 'width 0.3s ease'
  },
  progressText: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#64748b',
    minWidth: '60px',
    textAlign: 'right'
  },
  tipsModal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  tipsContent: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    maxWidth: '600px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
  },
  tipsHeader: {
    padding: '24px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  tipsTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#64748b'
  },
  tipsBody: {
    padding: '24px'
  },
  phase: {
    marginBottom: '20px',
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    border: '1px solid #e2e8f0'
  },
  phaseHeader: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '8px'
  },
  phaseContent: {
    fontSize: '14px',
    color: '#64748b',
    lineHeight: '1.6'
  },
  questionCard: {
    maxWidth: '800px',
    margin: '0 auto 32px',
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '32px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
  },
  questionType: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#3b82f6',
    marginBottom: '16px'
  },
  questionPrompt: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '32px',
    lineHeight: '1.4'
  },
  optionsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  optionButton: {
    backgroundColor: '#fff',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 500,
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
    color: '#0f172a'
  },
  typeInContainer: {
    display: 'flex',
    gap: '12px'
  },
  typeInInput: {
    flex: 1,
    padding: '16px',
    fontSize: '16px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    outline: 'none'
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 32px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  flashcardContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '32px 0'
  },
  showAnswerButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 48px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  answerContainer: {
    marginTop: '24px',
    padding: '24px',
    backgroundColor: '#f8fafc',
    borderRadius: '12px'
  },
  answerBadge: {
    display: 'inline-block',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '16px'
  },
  correctAnswer: {
    fontSize: '18px',
    color: '#0f172a',
    marginBottom: '12px'
  },
  example: {
    fontSize: '14px',
    color: '#64748b',
    fontStyle: 'italic'
  },
  qualityButtons: {
    display: 'flex',
    gap: '8px',
    marginTop: '16px'
  },
  qualityButton: {
    flex: 1,
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  stats: {
    maxWidth: '800px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'center',
    gap: '48px'
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 700
  },
  statLabel: {
    fontSize: '14px',
    color: '#64748b',
    fontWeight: 500
  },
  loading: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    color: '#64748b'
  }
};

export default LearnSession;

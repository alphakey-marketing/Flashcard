import React, { useState, useEffect, CSSProperties } from 'react';
import { FlashcardSet, Flashcard } from '../lib/storage';
import { CardReviewData, saveCardReview, ReviewRating } from '../lib/spacedRepetition';

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

const LearnMode: React.FC<LearnModeProps> = ({ set, onExit, onComplete }) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showAnswer, setShowAnswer] = useState(false);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showCongrats, setShowCongrats] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = () => {
    // Select up to 20 cards, prioritize new and due cards
    const sessionSize = Math.min(20, set.cards.length);
    if (sessionSize === 0) return;
    
    const selectedCards = [...set.cards]
      .sort(() => Math.random() - 0.5)
      .slice(0, sessionSize);

    // Generate questions with mixed types
    const generatedQuestions: Question[] = selectedCards.map((card, index) => {
      // Adaptive difficulty: easier questions first
      let questionType: QuestionType;
      const progress = index / sessionSize;
      
      if (progress < 0.3) {
        // First 30%: Multiple choice (easiest)
        questionType = 'multiple-choice';
      } else if (progress < 0.7) {
        // Middle 40%: Mix of flashcard and type-in
        questionType = Math.random() > 0.5 ? 'flashcard' : 'type-in';
      } else {
        // Final 30%: Type-in (hardest)
        questionType = 'type-in';
      }

      const question: Question = {
        card,
        type: questionType
      };

      // Generate distractors for multiple choice
      if (questionType === 'multiple-choice') {
        const correctAnswer = card.back;
        const otherCards = set.cards.filter(c => c.id !== card.id);
        const distractors = otherCards
          .sort(() => Math.random() - 0.5)
          .slice(0, 3)
          .map(c => c.back);
        
        const allOptions = [correctAnswer, ...distractors]
          .sort(() => Math.random() - 0.5);
        
        question.options = allOptions;
      }

      return question;
    });

    setQuestions(generatedQuestions);
  };

  const currentQuestion = questions[currentIndex];

  const playAudio = async (text: string, lang: string = 'ja-JP') => {
    if (isPlayingAudio) return;
    
    try {
      setIsPlayingAudio(true);
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.85; // Slightly slower for learning
      
      utterance.onend = () => setIsPlayingAudio(false);
      utterance.onerror = () => setIsPlayingAudio(false);
      
      window.speechSynthesis.cancel(); // Cancel any ongoing speech
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Audio playback error:', error);
      setIsPlayingAudio(false);
    }
  };

  const handleMultipleChoiceSelect = (option: string) => {
    if (showAnswer) return;
    
    setSelectedOption(option);
    const correct = option === currentQuestion.card.back;
    setIsCorrect(correct);
    setShowAnswer(true);
    
    if (correct) {
      setCorrectCount(correctCount + 1);
      // Record as "Know It" in spaced repetition
      saveCardReview(set.id, currentQuestion.card.id, 'know_it');
    } else {
      // Record as "Again" in spaced repetition
      saveCardReview(set.id, currentQuestion.card.id, 'again');
    }
  };

  const handleTypeInSubmit = () => {
    if (showAnswer) return;
    
    const correct = normalizeAnswer(userAnswer) === normalizeAnswer(currentQuestion.card.back);
    setIsCorrect(correct);
    setShowAnswer(true);
    
    if (correct) {
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
  };

  const handleTypeInConfirmWrong = () => {
    // User confirms their answer was wrong
    saveCardReview(set.id, currentQuestion.card.id, 'again');
    handleNext();
  };

  const handleFlashcardRate = (rating: ReviewRating) => {
    saveCardReview(set.id, currentQuestion.card.id, rating);
    
    if (rating === 'know_it' || rating === 'mastered') {
      setCorrectCount(correctCount + 1);
    }
    
    handleNext();
  };

  const normalizeAnswer = (str: string): string => {
    return str.toLowerCase().trim().replace(/[.,!?;:]/g, '');
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
      setIsCorrect(null);
      setUserAnswer('');
      setSelectedOption(null);
    } else {
      setShowCongrats(true);
    }
  };

  // Determine if the Next button should be shown
  const shouldShowNextButton = () => {
    if (!showAnswer || currentQuestion.type === 'flashcard') return false;
    if (currentQuestion.type === 'multiple-choice') return true;
    if (currentQuestion.type === 'type-in' && isCorrect) return true;
    return false; // Type-in wrong state has its own override buttons
  };

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
                initializeSession();
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
            <div style={styles.questionFront}>{currentQuestion.card.front}</div>
            <button
              style={styles.audioButton}
              onClick={() => playAudio(currentQuestion.card.front, 'ja-JP')}
              disabled={isPlayingAudio}
              title="Play audio"
              onMouseEnter={(e) => !isPlayingAudio && (e.currentTarget.style.transform = 'scale(1.1)')}
              onMouseLeave={(e) => !isPlayingAudio && (e.currentTarget.style.transform = 'scale(1)')}
            >
              {isPlayingAudio ? '🔊' : '🔈'}
            </button>
          </div>
          {currentQuestion.card.example && (
            <div style={styles.questionExampleRow}>
              <div style={styles.questionExample}>
                Example: {currentQuestion.card.example}
              </div>
              <button
                style={styles.audioButtonSmall}
                onClick={() => playAudio(currentQuestion.card.example!, 'ja-JP')}
                disabled={isPlayingAudio}
                title="Play example audio"
                onMouseEnter={(e) => !isPlayingAudio && (e.currentTarget.style.transform = 'scale(1.1)')}
                onMouseLeave={(e) => !isPlayingAudio && (e.currentTarget.style.transform = 'scale(1)')}
              >
                {isPlayingAudio ? '🔊' : '🔈'}
              </button>
            </div>
          )}
        </div>

        {/* Multiple Choice */}
        {currentQuestion.type === 'multiple-choice' && (
          <div style={styles.optionsContainer}>
            {currentQuestion.options?.map((option, idx) => {
              const isSelected = selectedOption === option;
              const isCorrectOption = option === currentQuestion.card.back;
              
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
                  {option}
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
              placeholder="Type your answer..."
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
                  {isCorrect ? '✓ Correct!' : `✗ Expected: ${currentQuestion.card.back}`}
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
                  <div style={styles.flashcardAnswer}>{currentQuestion.card.back}</div>
                  <button
                    style={styles.audioButton}
                    onClick={() => playAudio(currentQuestion.card.back, 'ja-JP')}
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
            onClick={handleNext}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {currentIndex < questions.length - 1 ? 'Next →' : 'Finish'}
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
  audioButtonSmall: {
    backgroundColor: '#f1f5f9',
    border: '2px solid #cbd5e1',
    borderRadius: '50%',
    width: '36px',
    height: '36px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '16px',
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
    textAlign: 'left'
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
    gap: '16px',
    marginBottom: '8px'
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
  }
};

export default LearnMode;

import React, { useState, useEffect, CSSProperties } from 'react';
import { FlashcardSet } from '../lib/storage';
import { getSetReviewData } from '../lib/spacedRepetition';
import {
  generateChallenge,
  submitChallengeAnswer,
  getChallengeHistory,
  SentenceChallenge
} from '../lib/sentenceBuilder';

interface SentenceBuilderProps {
  set: FlashcardSet;
  onExit: () => void;
}

// Helper to compute differences between original and corrected text
function computeDiff(original: string, corrected: string): Array<{text: string; isError: boolean}> {
  if (original === corrected) return [{text: original, isError: false}];
  
  // Simple word-level diff
  const originalWords = original.split(/\s+/);
  const correctedWords = corrected.split(/\s+/);
  const result: Array<{text: string; isError: boolean}> = [];
  
  const maxLen = Math.max(originalWords.length, correctedWords.length);
  for (let i = 0; i < maxLen; i++) {
    const orig = originalWords[i] || '';
    const corr = correctedWords[i] || '';
    
    if (orig === corr) {
      result.push({text: orig + ' ', isError: false});
    } else {
      if (orig) result.push({text: orig + ' ', isError: true});
      if (corr && corr !== orig) result.push({text: '[' + corr + '] ', isError: false});
    }
  }
  
  return result;
}

const SentenceBuilder: React.FC<SentenceBuilderProps> = ({ set, onExit }) => {
  const [currentChallenge, setCurrentChallenge] = useState<SentenceChallenge | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<{
    score: number;
    feedback: string[];
    isCorrect: boolean;
  } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  
  // Correction workflow states
  const [showCorrectionMode, setShowCorrectionMode] = useState(false);
  const [correctedAnswer, setCorrectedAnswer] = useState('');
  const [diff, setDiff] = useState<Array<{text: string; isError: boolean}>>([]);

  // Get mastered cards using the correct status check
  const reviewData = getSetReviewData(set.id);
  const masteredCardIds = new Set(
    reviewData
      .filter(r => r.status === 'mastered')
      .map(r => r.cardId)
  );
  const masteredCards = set.cards.filter(card => masteredCardIds.has(card.id));

  useEffect(() => {
    loadNewChallenge();
    loadHistory();
  }, []);

  const loadNewChallenge = () => {
    if (masteredCards.length < 3) return;
    const challenge = generateChallenge(set.id, masteredCards);
    setCurrentChallenge(challenge);
    setUserAnswer('');
    setFeedback(null);
    setShowCorrectionMode(false);
    setCorrectedAnswer('');
    setDiff([]);
  };

  const loadHistory = () => {
    const challengeHistory = getChallengeHistory(set.id, 10);
    setHistory(challengeHistory);
  };

  const handleSubmit = () => {
    if (!currentChallenge || !userAnswer.trim()) return;

    const result = submitChallengeAnswer(
      currentChallenge.challengeId,
      set.id,
      userAnswer
    );

    setFeedback(result);
    loadHistory();
  };

  const handleNext = () => {
    loadNewChallenge();
  };
  
  const handleEnterCorrectionMode = () => {
    setCorrectedAnswer(userAnswer);
    setShowCorrectionMode(true);
  };
  
  const handleSubmitCorrection = () => {
    const diffResult = computeDiff(userAnswer, correctedAnswer);
    setDiff(diffResult);
  };
  
  const handleResetCorrection = () => {
    setCorrectedAnswer(userAnswer);
    setDiff([]);
  };

  if (masteredCards.length < 3) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={onExit}>← Exit</button>
          <h2 style={styles.headerTitle}>Sentence Builder</h2>
          <div style={{ width: '100px' }} />
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🏗️</div>
          <p style={styles.emptyText}>
            Master at least 3 cards to start building sentences!
          </p>
          <p style={styles.emptyHint}>Use Learn Mode and mark cards as "Mastered" to unlock this feature.</p>
        </div>
      </div>
    );
  }

  if (showHistory) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={() => setShowHistory(false)}>
            ← Back
          </button>
          <h2 style={styles.headerTitle}>Challenge History</h2>
          <div style={{ width: '100px' }} />
        </div>

        <div style={styles.historyContainer}>
          {history.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyText}>No challenges completed yet!</p>
            </div>
          ) : (
            history.map((entry, idx) => (
              <div key={idx} style={styles.historyEntry}>
                <div style={styles.historyScore}>
                  <span style={styles.historyScoreValue}>{entry.score}</span>
                  <span style={styles.historyScoreLabel}>/ 100</span>
                </div>
                <div style={styles.historyContent}>
                  <div style={styles.historyPrompt}>
                    <strong>Prompt:</strong> {entry.prompt}
                  </div>
                  <div style={styles.historyWords}>
                    <strong>Words:</strong> {entry.words.map((w: any) => w.front).join(', ')}
                  </div>
                  <div style={styles.historyAnswer}>
                    <strong>Your answer:</strong> {entry.userAnswer}
                  </div>
                  <div style={styles.historyDate}>
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (!currentChallenge) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onExit}>← Exit</button>
        <h2 style={styles.headerTitle}>Sentence Builder</h2>
        <button style={styles.historyButton} onClick={() => setShowHistory(true)}>
          📜 History
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.challengeCard}>
          <div style={styles.challengeHeader}>
            <div style={styles.challengeIcon}>🏗️</div>
            <div style={styles.challengeTitle}>Build a Sentence</div>
          </div>

          <div style={styles.promptSection}>
            <div style={styles.promptLabel}>Prompt:</div>
            <div style={styles.promptText}>{currentChallenge.prompt}</div>
          </div>

          <div style={styles.wordsSection}>
            <div style={styles.wordsLabel}>Use these words:</div>
            <div style={styles.wordsGrid}>
              {currentChallenge.words.map((word, idx) => (
                <div key={idx} style={styles.wordBadge}>
                  <div style={styles.wordFront}>{word.front}</div>
                  <div style={styles.wordBack}>{word.back}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.answerSection}>
            <label style={styles.answerLabel}>Your Sentence:</label>
            <textarea
              style={{
                ...styles.answerTextarea,
                ...(feedback ? styles.answerTextareaDisabled : {})
              }}
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              placeholder="Write your sentence here...\n\n例: 私は..."
              rows={4}
              disabled={feedback !== null}
            />

            {!feedback ? (
              <button
                style={{
                  ...styles.submitButton,
                  opacity: !userAnswer.trim() ? 0.5 : 1
                }}
                onClick={handleSubmit}
                disabled={!userAnswer.trim()}
              >
                ✓ Submit Answer
              </button>
            ) : (
              <div style={styles.feedbackSection}>
                <div
                  style={{
                    ...styles.scoreCard,
                    backgroundColor: feedback.score >= 70 ? '#d1fae5' : feedback.score >= 40 ? '#fef3c7' : '#fee2e2',
                    borderColor: feedback.score >= 70 ? '#10b981' : feedback.score >= 40 ? '#f59e0b' : '#ef4444'
                  }}
                >
                  <div style={styles.scoreBadge}>
                    <span style={styles.scoreValue}>{feedback.score}</span>
                    <span style={styles.scoreMax}> / 100</span>
                  </div>
                  <div style={{
                    ...styles.scoreLabel,
                    color: feedback.score >= 70 ? '#065f46' : feedback.score >= 40 ? '#92400e' : '#7f1d1d'
                  }}>
                    {feedback.score >= 70 ? '🎉 Great job!' : feedback.score >= 40 ? '👍 Good effort!' : '💪 Keep practicing!'}
                  </div>
                </div>

                <div style={styles.feedbackList}>
                  {feedback.feedback.map((item, idx) => (
                    <div key={idx} style={styles.feedbackItem}>
                      {item.startsWith('✅') || item.startsWith('✓') ? '✅' : '⚠️'} {item.replace(/^[✅✓❌⚠️]\s*/, '')}
                    </div>
                  ))}
                </div>

                {/* Self-correction workflow */}
                {!showCorrectionMode ? (
                  <button style={styles.correctionButton} onClick={handleEnterCorrectionMode}>
                    ✏️ Self-Correct My Answer
                  </button>
                ) : (
                  <div style={styles.correctionSection}>
                    <label style={styles.correctionLabel}>Corrected Version:</label>
                    <textarea
                      style={styles.correctionTextarea}
                      value={correctedAnswer}
                      onChange={(e) => setCorrectedAnswer(e.target.value)}
                      placeholder="Edit your sentence to fix grammar/vocabulary..."
                      rows={4}
                    />
                    <div style={styles.correctionButtons}>
                      <button style={styles.submitCorrectionButton} onClick={handleSubmitCorrection}>
                        Show Differences
                      </button>
                      <button style={styles.resetCorrectionButton} onClick={handleResetCorrection}>
                        Reset
                      </button>
                    </div>
                    
                    {diff.length > 0 && (
                      <div style={styles.diffSection}>
                        <div style={styles.diffLabel}>Changes highlighted:</div>
                        <div style={styles.diffText}>
                          {diff.map((part, idx) => (
                            <span
                              key={idx}
                              style={{
                                ...styles.diffPart,
                                ...(part.isError ? styles.diffError : {})
                              }}
                            >
                              {part.text}
                            </span>
                          ))}
                        </div>
                        <div style={styles.diffLegend}>
                          <span style={styles.diffLegendError}>Red = Original error</span>
                          <span style={styles.diffLegendCorrect}>[Bracket] = Correction</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button style={styles.nextButton} onClick={handleNext}>
                  Next Challenge →
                </button>
              </div>
            )}
          </div>

          <div style={styles.tipsBox}>
            <div style={styles.tipsTitle}>💡 Tips:</div>
            <ul style={styles.tipsList}>
              <li>Use all the provided words in your sentence</li>
              <li>Make sure your sentence is grammatically correct</li>
              <li>Aim for 5-15 words in length</li>
              <li>End with proper Japanese punctuation (。)</li>
            </ul>
          </div>
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
  backButton: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#64748b',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '8px 16px',
    fontWeight: 600
  },
  headerTitle: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0
  },
  historyButton: {
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#475569',
    minWidth: '100px'
  },
  content: {
    flex: 1,
    padding: '32px 24px',
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%'
  },
  challengeCard: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '32px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
  },
  challengeHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '2px solid #f1f5f9'
  },
  challengeIcon: {
    fontSize: '32px'
  },
  challengeTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#0f172a'
  },
  promptSection: {
    marginBottom: '24px'
  },
  promptLabel: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '8px'
  },
  promptText: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#0f172a',
    lineHeight: '1.6'
  },
  wordsSection: {
    marginBottom: '32px'
  },
  wordsLabel: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '12px'
  },
  wordsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px'
  },
  wordBadge: {
    backgroundColor: '#f0f9ff',
    border: '2px solid #3b82f6',
    borderRadius: '8px',
    padding: '8px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  wordFront: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1e3a8a'
  },
  wordBack: {
    fontSize: '12px',
    color: '#60a5fa'
  },
  answerSection: {
    marginBottom: '24px'
  },
  answerLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '12px'
  },
  answerTextarea: {
    width: '100%',
    padding: '16px',
    fontSize: '16px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: '1.8',
    marginBottom: '16px'
  },
  answerTextareaDisabled: {
    backgroundColor: '#f8fafc',
    color: '#475569'
  },
  submitButton: {
    width: '100%',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  feedbackSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  scoreCard: {
    border: '2px solid',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  scoreBadge: {
    display: 'flex',
    alignItems: 'baseline'
  },
  scoreValue: {
    fontSize: '48px',
    fontWeight: 700
  },
  scoreMax: {
    fontSize: '24px',
    fontWeight: 600,
    opacity: 0.7
  },
  scoreLabel: {
    fontSize: '18px',
    fontWeight: 600
  },
  feedbackList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  feedbackItem: {
    fontSize: '14px',
    color: '#475569',
    padding: '8px 12px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px'
  },
  correctionButton: {
    width: '100%',
    backgroundColor: '#8b5cf6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  correctionSection: {
    backgroundColor: '#f8fafc',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px'
  },
  correctionLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '8px'
  },
  correctionTextarea: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    border: '2px solid #8b5cf6',
    borderRadius: '8px',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: '1.8',
    marginBottom: '12px'
  },
  correctionButtons: {
    display: 'flex',
    gap: '8px'
  },
  submitCorrectionButton: {
    flex: 1,
    backgroundColor: '#8b5cf6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  resetCorrectionButton: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  diffSection: {
    marginTop: '16px',
    padding: '16px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '2px solid #8b5cf6'
  },
  diffLabel: {
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '12px'
  },
  diffText: {
    fontSize: '16px',
    lineHeight: '1.8',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    marginBottom: '12px'
  },
  diffPart: {
    fontFamily: 'inherit'
  },
  diffError: {
    color: '#ef4444',
    fontWeight: 600,
    textDecoration: 'line-through'
  },
  diffLegend: {
    display: 'flex',
    gap: '16px',
    fontSize: '12px',
    color: '#64748b'
  },
  diffLegendError: {
    color: '#ef4444',
    fontWeight: 600
  },
  diffLegendCorrect: {
    fontWeight: 600
  },
  nextButton: {
    width: '100%',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  tipsBox: {
    backgroundColor: '#fef3c7',
    border: '2px solid #f59e0b',
    borderRadius: '12px',
    padding: '16px'
  },
  tipsTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#92400e',
    marginBottom: '12px'
  },
  tipsList: {
    margin: 0,
    paddingLeft: '24px',
    color: '#78350f',
    lineHeight: '1.8',
    fontSize: '14px'
  },
  historyContainer: {
    padding: '24px',
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%'
  },
  historyEntry: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '20px',
    marginBottom: '16px',
    display: 'flex',
    gap: '20px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
  },
  historyScore: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '80px'
  },
  historyScoreValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#3b82f6'
  },
  historyScoreLabel: {
    fontSize: '14px',
    color: '#64748b'
  },
  historyContent: {
    flex: 1
  },
  historyPrompt: {
    fontSize: '14px',
    color: '#0f172a',
    marginBottom: '8px'
  },
  historyWords: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '8px'
  },
  historyAnswer: {
    fontSize: '16px',
    color: '#0f172a',
    marginBottom: '8px',
    fontWeight: 500
  },
  historyDate: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  emptyState: {
    textAlign: 'center',
    padding: '64px 24px'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  emptyText: {
    fontSize: '16px',
    color: '#64748b',
    marginBottom: '8px'
  },
  emptyHint: {
    fontSize: '14px',
    color: '#94a3b8'
  }
};

export default SentenceBuilder;

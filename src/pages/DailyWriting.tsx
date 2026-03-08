import React, { useState, useEffect, CSSProperties } from 'react';
import { FlashcardSet } from '../lib/storage';
import { getSetReviewData } from '../lib/spacedRepetition';
import {
  getTodayPrompt,
  completeDailyPrompt,
  getPromptHistory,
  getPromptStreak,
  DailyPrompt
} from '../lib/sentenceBuilder';

interface DailyWritingProps {
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

const DailyWriting: React.FC<DailyWritingProps> = ({ set, onExit }) => {
  const [todayPrompt, setTodayPrompt] = useState<DailyPrompt | null>(null);
  const [userEntry, setUserEntry] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [history, setHistory] = useState<DailyPrompt[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [streak, setStreak] = useState(0);
  
  // Correction workflow states
  const [showCorrectionMode, setShowCorrectionMode] = useState(false);
  const [correctedEntry, setCorrectedEntry] = useState('');
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
    loadTodayPrompt();
    loadHistory();
    loadStreak();
  }, [set.id]);

  const loadTodayPrompt = () => {
    if (masteredCards.length < 3) {
      setTodayPrompt(null);
      return;
    }

    const prompt = getTodayPrompt(set.id, masteredCards);
    setTodayPrompt(prompt);
    
    if (prompt?.userEntry) {
      setUserEntry(prompt.userEntry);
      setIsSubmitted(true);
    }
  };

  const loadHistory = () => {
    const promptHistory = getPromptHistory(set.id, 30);
    setHistory(promptHistory);
  };

  const loadStreak = () => {
    const currentStreak = getPromptStreak(set.id);
    setStreak(currentStreak);
  };

  const handleSubmit = () => {
    if (!todayPrompt || !userEntry.trim()) return;

    completeDailyPrompt(todayPrompt.date, set.id, userEntry);
    setIsSubmitted(true);
    loadStreak();
    loadHistory();
  };

  const handleEdit = () => {
    setIsSubmitted(false);
    setShowCorrectionMode(false);
    setDiff([]);
  };
  
  const handleEnterCorrectionMode = () => {
    setCorrectedEntry(userEntry);
    setShowCorrectionMode(true);
  };
  
  const handleSubmitCorrection = () => {
    const diffResult = computeDiff(userEntry, correctedEntry);
    setDiff(diffResult);
  };
  
  const handleResetCorrection = () => {
    setCorrectedEntry(userEntry);
    setDiff([]);
  };

  if (masteredCards.length < 3) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={onExit}>← Exit</button>
          <h2 style={styles.headerTitle}>Daily Writing</h2>
          <div style={{ width: '100px' }} />
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>✍️</div>
          <p style={styles.emptyText}>
            Master at least 3 cards to start daily writing practice!
          </p>
          <p style={styles.emptyHint}>Use Learn Mode and mark cards as "Mastered" to unlock this feature.</p>
        </div>
      </div>
    );
  }

  if (!todayPrompt) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={onExit}>← Exit</button>
          <h2 style={styles.headerTitle}>Daily Writing</h2>
          <div style={{ width: '100px' }} />
        </div>
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>✍️</div>
          <p style={styles.emptyText}>Unable to generate prompt. Please try again.</p>
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
          <h2 style={styles.headerTitle}>Writing Journal</h2>
          <div style={{ width: '100px' }} />
        </div>

        <div style={styles.historyContainer}>
          {history.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📝</div>
              <p style={styles.emptyText}>No entries yet. Start writing today!</p>
            </div>
          ) : (
            history.map((entry) => (
              <div key={entry.date} style={styles.journalEntry}>
                <div style={styles.journalDate}>
                  📅 {new Date(entry.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
                <div style={styles.journalPrompt}>
                  <strong>Prompt:</strong> {entry.prompt}
                </div>
                <div style={styles.journalWords}>
                  <strong>Words used:</strong>{' '}
                  {entry.words.map(w => w.front.split('[')[0].trim()).join(', ')}
                </div>
                <div style={styles.journalText}>{entry.userEntry}</div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onExit}>← Exit</button>
        <h2 style={styles.headerTitle}>Daily Writing</h2>
        <button style={styles.historyButton} onClick={() => setShowHistory(true)}>
          📖 Journal
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.streakBanner}>
          <div style={styles.streakIcon}>🔥</div>
          <div>
            <div style={styles.streakValue}>{streak} Day Streak!</div>
            <div style={styles.streakLabel}>
              {streak === 0 ? 'Start your journey today' : 'Keep it going!'}
            </div>
          </div>
        </div>

        <div style={styles.promptCard}>
          <div style={styles.dateHeader}>
            <div style={styles.dateIcon}>📅</div>
            <div style={styles.dateText}>{today}</div>
          </div>

          <div style={styles.promptSection}>
            <div style={styles.promptLabel}>Today's Prompt:</div>
            <div style={styles.promptText}>{todayPrompt.prompt}</div>
          </div>

          <div style={styles.wordsSection}>
            <div style={styles.wordsLabel}>Use these words:</div>
            <div style={styles.wordsGrid}>
              {todayPrompt.words.map((word, idx) => (
                <div key={idx} style={styles.wordTag}>
                  <div style={styles.wordTagFront}>{word.front}</div>
                  <div style={styles.wordTagBack}>{word.back}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.writingSection}>
            <label style={styles.writingLabel}>Your Entry:</label>
            <textarea
              style={{
                ...styles.writingTextarea,
                ...(isSubmitted ? styles.writingTextareaDisabled : {})
              }}
              value={userEntry}
              onChange={(e) => setUserEntry(e.target.value)}
              placeholder="Write about your day using the words above...\n\n今日は..."
              rows={8}
              disabled={isSubmitted}
            />

            {!isSubmitted ? (
              <button
                style={{
                  ...styles.submitButton,
                  opacity: !userEntry.trim() ? 0.5 : 1
                }}
                onClick={handleSubmit}
                disabled={!userEntry.trim()}
              >
                ✓ Save Entry
              </button>
            ) : (
              <div style={styles.submittedSection}>
                <div style={styles.submittedBadge}>✅ Entry saved!</div>
                <button style={styles.editButton} onClick={handleEdit}>
                  ✏️ Edit
                </button>
              </div>
            )}
          </div>

          {/* Self-correction workflow - only show after submission */}
          {isSubmitted && (
            <div style={styles.correctionContainer}>
              {!showCorrectionMode ? (
                <button style={styles.correctionButton} onClick={handleEnterCorrectionMode}>
                  ✏️ Self-Correct My Entry
                </button>
              ) : (
                <div style={styles.correctionSection}>
                  <label style={styles.correctionLabel}>Corrected Version:</label>
                  <textarea
                    style={styles.correctionTextarea}
                    value={correctedEntry}
                    onChange={(e) => setCorrectedEntry(e.target.value)}
                    placeholder="Edit your entry to fix grammar/vocabulary..."
                    rows={8}
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
            </div>
          )}

          <div style={styles.encouragement}>
            <div style={styles.encouragementIcon}>💡</div>
            <div style={styles.encouragementText}>
              {isSubmitted
                ? 'Great work! Come back tomorrow for a new prompt.'
                : 'Write 2-3 sentences. Don\'t worry about perfection—just practice!'}
            </div>
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
  streakBanner: {
    backgroundColor: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    borderRadius: '16px',
    padding: '20px 24px',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    boxShadow: '0 4px 12px rgba(251, 191, 36, 0.3)'
  },
  streakIcon: {
    fontSize: '48px'
  },
  streakValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: 'white'
  },
  streakLabel: {
    fontSize: '14px',
    color: 'rgba(255, 255, 255, 0.9)'
  },
  promptCard: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '32px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
  },
  dateHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '2px solid #f1f5f9'
  },
  dateIcon: {
    fontSize: '24px'
  },
  dateText: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#64748b'
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
    fontSize: '20px',
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
  wordTag: {
    backgroundColor: '#f0f9ff',
    border: '2px solid #3b82f6',
    borderRadius: '8px',
    padding: '8px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  wordTagFront: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#1e3a8a'
  },
  wordTagBack: {
    fontSize: '12px',
    color: '#60a5fa'
  },
  writingSection: {
    marginBottom: '24px'
  },
  writingLabel: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '12px'
  },
  writingTextarea: {
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
  writingTextareaDisabled: {
    backgroundColor: '#f8fafc',
    color: '#475569'
  },
  submitButton: {
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
  submittedSection: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px'
  },
  submittedBadge: {
    flex: 1,
    backgroundColor: '#d1fae5',
    color: '#065f46',
    padding: '16px',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 600,
    textAlign: 'center'
  },
  editButton: {
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#475569'
  },
  correctionContainer: {
    marginBottom: '24px'
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
  encouragement: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#fef3c7',
    padding: '16px',
    borderRadius: '12px'
  },
  encouragementIcon: {
    fontSize: '24px'
  },
  encouragementText: {
    fontSize: '14px',
    color: '#78350f',
    lineHeight: '1.6'
  },
  historyContainer: {
    padding: '24px',
    maxWidth: '800px',
    margin: '0 auto',
    width: '100%'
  },
  journalEntry: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '24px',
    marginBottom: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
  },
  journalDate: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#3b82f6',
    marginBottom: '12px'
  },
  journalPrompt: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '8px'
  },
  journalWords: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '16px'
  },
  journalText: {
    fontSize: '16px',
    color: '#0f172a',
    lineHeight: '1.8',
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px',
    borderLeft: '4px solid #3b82f6'
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
    lineHeight: '1.6',
    marginBottom: '8px'
  },
  emptyHint: {
    fontSize: '14px',
    color: '#94a3b8'
  }
};

export default DailyWriting;

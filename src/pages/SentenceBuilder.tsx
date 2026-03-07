import React, { useState, useEffect, CSSProperties } from 'react';
import { FlashcardSet } from '../lib/storage';
import {
  generateSentenceChallenge,
  saveSentenceChallenge,
  completeSentenceChallenge,
  validateSentence,
  getActiveChallenges,
  getCompletedChallenges,
  SentenceChallenge
} from '../lib/sentenceBuilder';

interface SentenceBuilderProps {
  set: FlashcardSet;
  onExit: () => void;
}

const SentenceBuilder: React.FC<SentenceBuilderProps> = ({ set, onExit }) => {
  const [activeChallenge, setActiveChallenge] = useState<SentenceChallenge | null>(null);
  const [userSentence, setUserSentence] = useState('');
  const [validation, setValidation] = useState<{
    isValid: boolean;
    feedback: string;
    score: number;
  } | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [completedChallenges, setCompletedChallenges] = useState<SentenceChallenge[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    loadChallenges();
  }, [set.id]);

  const loadChallenges = () => {
    const active = getActiveChallenges(set.id);
    const completed = getCompletedChallenges(set.id);
    
    if (active.length > 0) {
      setActiveChallenge(active[0]);
    }
    
    setCompletedChallenges(completed);
  };

  const handleNewChallenge = () => {
    const challenge = generateSentenceChallenge(set.id, set.cards);
    
    if (!challenge) {
      alert('Need at least 3 mastered cards to create a sentence challenge. Keep studying!');
      return;
    }

    saveSentenceChallenge(challenge);
    setActiveChallenge(challenge);
    setUserSentence('');
    setValidation(null);
    setIsSubmitted(false);
  };

  const handleSubmit = () => {
    if (!activeChallenge || !userSentence.trim()) return;

    const result = validateSentence(userSentence, activeChallenge.words);
    setValidation(result);
    setIsSubmitted(true);

    if (result.isValid) {
      completeSentenceChallenge(activeChallenge.id, userSentence, result.feedback);
      setTimeout(() => {
        loadChallenges();
      }, 2000);
    }
  };

  const handleTryAgain = () => {
    setUserSentence('');
    setValidation(null);
    setIsSubmitted(false);
  };

  const handleNextChallenge = () => {
    setUserSentence('');
    setValidation(null);
    setIsSubmitted(false);
    setActiveChallenge(null);
  };

  if (showHistory) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={() => setShowHistory(false)}>
            ← Back
          </button>
          <h2 style={styles.headerTitle}>Sentence History</h2>
          <div style={{ width: '80px' }} />
        </div>

        <div style={styles.historyContainer}>
          {completedChallenges.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📝</div>
              <p style={styles.emptyText}>No completed sentences yet.</p>
            </div>
          ) : (
            completedChallenges.map((challenge) => (
              <div key={challenge.id} style={styles.historyCard}>
                <div style={styles.historyDate}>
                  {new Date(challenge.completedAt!).toLocaleDateString()}
                </div>
                <div style={styles.historyWords}>
                  <strong>Words used:</strong>{' '}
                  {challenge.words.map(w => w.front.split('[')[0].trim()).join(', ')}
                </div>
                <div style={styles.historySentence}>{challenge.userSentence}</div>
                <div style={styles.historyFeedback}>{challenge.feedback}</div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onExit}>
          ← Exit
        </button>
        <h2 style={styles.headerTitle}>Sentence Builder</h2>
        <button
          style={styles.historyButton}
          onClick={() => setShowHistory(true)}
        >
          📚 History
        </button>
      </div>

      <div style={styles.content}>
        {!activeChallenge ? (
          <div style={styles.welcomeCard}>
            <div style={styles.welcomeIcon}>🏗️</div>
            <h1 style={styles.welcomeTitle}>Sentence Builder</h1>
            <p style={styles.welcomeText}>
              Create your own Japanese sentences using words you've mastered!
            </p>
            <div style={styles.instructions}>
              <h3 style={styles.instructionsTitle}>How it works:</h3>
              <ul style={styles.instructionsList}>
                <li>You'll get 3-5 words from your mastered vocabulary</li>
                <li>Create a grammatically correct sentence using all words</li>
                <li>Get instant feedback on your sentence</li>
                <li>Build real writing skills!</li>
              </ul>
            </div>
            <button
              style={styles.startButton}
              onClick={handleNewChallenge}
            >
              🚀 Start Challenge
            </button>
            {completedChallenges.length > 0 && (
              <div style={styles.stats}>
                <div style={styles.statItem}>
                  <div style={styles.statValue}>{completedChallenges.length}</div>
                  <div style={styles.statLabel}>Sentences Created</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={styles.challengeCard}>
            <div style={styles.challengeHeader}>
              <h2 style={styles.challengeTitle}>Create a Sentence</h2>
              <div style={styles.challengeSubtitle}>
                Use all {activeChallenge.words.length} words below:
              </div>
            </div>

            <div style={styles.wordsGrid}>
              {activeChallenge.words.map((word, idx) => (
                <div key={idx} style={styles.wordChip}>
                  <div style={styles.wordFront}>{word.front}</div>
                  <div style={styles.wordBack}>{word.back}</div>
                </div>
              ))}
            </div>

            <div style={styles.inputSection}>
              <label style={styles.inputLabel}>Your Sentence:</label>
              <textarea
                style={{
                  ...styles.sentenceInput,
                  ...(validation && !validation.isValid ? styles.sentenceInputError : {})
                }}
                value={userSentence}
                onChange={(e) => setUserSentence(e.target.value)}
                placeholder="文章をここに書いてください... (Write your sentence here...)"
                disabled={isSubmitted && validation?.isValid}
                rows={4}
              />

              {!isSubmitted ? (
                <button
                  style={{
                    ...styles.submitButton,
                    opacity: !userSentence.trim() ? 0.5 : 1
                  }}
                  onClick={handleSubmit}
                  disabled={!userSentence.trim()}
                >
                  ✓ Check Sentence
                </button>
              ) : (
                <div style={styles.feedbackSection}>
                  <div
                    style={{
                      ...styles.feedbackBox,
                      ...(validation?.isValid ? styles.feedbackSuccess : styles.feedbackError)
                    }}
                  >
                    <div style={styles.feedbackText}>{validation?.feedback}</div>
                    {validation?.score !== undefined && (
                      <div style={styles.scoreText}>Score: {validation.score}/100</div>
                    )}
                  </div>

                  {validation?.isValid ? (
                    <button
                      style={styles.nextButton}
                      onClick={handleNextChallenge}
                    >
                      Next Challenge →
                    </button>
                  ) : (
                    <button
                      style={styles.tryAgainButton}
                      onClick={handleTryAgain}
                    >
                      🔄 Try Again
                    </button>
                  )}
                </div>
              )}
            </div>

            <div style={styles.tips}>
              <div style={styles.tipsTitle}>💡 Tips:</div>
              <ul style={styles.tipsList}>
                <li>Use proper particles (は、が、を、に、で、etc.)</li>
                <li>End with proper punctuation (。)</li>
                <li>Make sure the sentence is natural and complete</li>
              </ul>
            </div>
          </div>
        )}
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
    color: '#475569'
  },
  content: {
    flex: 1,
    padding: '32px 24px',
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%'
  },
  welcomeCard: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '48px',
    textAlign: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
  },
  welcomeIcon: {
    fontSize: '72px',
    marginBottom: '24px'
  },
  welcomeTitle: {
    fontSize: '36px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '16px'
  },
  welcomeText: {
    fontSize: '18px',
    color: '#64748b',
    marginBottom: '32px',
    lineHeight: '1.6'
  },
  instructions: {
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '32px',
    textAlign: 'left'
  },
  instructionsTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '12px'
  },
  instructionsList: {
    margin: 0,
    paddingLeft: '24px',
    color: '#475569',
    lineHeight: '1.8'
  },
  startButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 48px',
    fontSize: '18px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s'
  },
  stats: {
    marginTop: '32px',
    display: 'flex',
    justifyContent: 'center',
    gap: '32px'
  },
  statItem: {
    textAlign: 'center'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#3b82f6'
  },
  statLabel: {
    fontSize: '14px',
    color: '#64748b',
    marginTop: '4px'
  },
  challengeCard: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '40px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
  },
  challengeHeader: {
    marginBottom: '32px',
    textAlign: 'center'
  },
  challengeTitle: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '8px'
  },
  challengeSubtitle: {
    fontSize: '16px',
    color: '#64748b'
  },
  wordsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
    marginBottom: '32px'
  },
  wordChip: {
    backgroundColor: '#f8fafc',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center'
  },
  wordFront: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '8px'
  },
  wordBack: {
    fontSize: '14px',
    color: '#64748b'
  },
  inputSection: {
    marginBottom: '32px'
  },
  inputLabel: {
    display: 'block',
    fontSize: '16px',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '12px'
  },
  sentenceInput: {
    width: '100%',
    padding: '16px',
    fontSize: '16px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: '1.6',
    marginBottom: '16px'
  },
  sentenceInputError: {
    borderColor: '#ef4444'
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
  feedbackBox: {
    padding: '20px',
    borderRadius: '12px',
    border: '2px solid'
  },
  feedbackSuccess: {
    backgroundColor: '#d1fae5',
    borderColor: '#10b981',
    color: '#065f46'
  },
  feedbackError: {
    backgroundColor: '#fee2e2',
    borderColor: '#ef4444',
    color: '#991b1b'
  },
  feedbackText: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '8px'
  },
  scoreText: {
    fontSize: '14px',
    opacity: 0.8
  },
  nextButton: {
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  tryAgainButton: {
    backgroundColor: '#f59e0b',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  tips: {
    backgroundColor: '#fffbeb',
    border: '2px solid #fbbf24',
    borderRadius: '12px',
    padding: '20px'
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
    maxWidth: '900px',
    margin: '0 auto',
    width: '100%'
  },
  historyCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '16px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
  },
  historyDate: {
    fontSize: '12px',
    color: '#64748b',
    marginBottom: '8px'
  },
  historyWords: {
    fontSize: '14px',
    color: '#475569',
    marginBottom: '12px'
  },
  historySentence: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '8px',
    padding: '12px',
    backgroundColor: '#f8fafc',
    borderRadius: '8px'
  },
  historyFeedback: {
    fontSize: '14px',
    color: '#059669',
    fontWeight: 500
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
    color: '#64748b'
  }
};

export default SentenceBuilder;

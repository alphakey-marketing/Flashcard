import React, { useState, useEffect, CSSProperties } from 'react';
import { FlashcardSet, Card } from '../lib/storage';
import { getSetReviewData } from '../lib/spacedRepetition';
import {
  generateChallenge,
  submitChallengeAnswer,
  getChallengeHistory,
  getCurrentChallenge,
  clearCurrentChallenge,
  deleteChallenge,
  SentenceChallenge
} from '../lib/sentenceBuilder';

interface SentenceBuilderProps {
  set: FlashcardSet;
  onExit: () => void;
}

// ─── Block-game helpers ─────────────────────────────────────────────────────

/** Extract the example sentence from a card (second line of front, or legacy example field). */
function getCardExample(card: Card): string {
  const lines = card.front.split('\n');
  if (lines.length > 1 && lines[1].trim()) return lines[1].trim();
  return (card.example || '').trim();
}

/** Segment a Japanese sentence into blocks for the block game. */
function segmentForBlockGame(text: string): string[] {
  const s = text.replace(/[。！？.!?、,]+$/g, '').trim();
  if (!s) return [text];

  // First pass: split at clearly standalone case particles
  const SPLIT_PARTICLES = new Set(['は', 'を', 'も', 'へ']);
  const tokens: string[] = [];
  let current = '';

  for (const ch of s) {
    if (SPLIT_PARTICLES.has(ch)) {
      if (current) { tokens.push(current); current = ''; }
      tokens.push(ch);
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);

  // Second pass: split at te-form conjunctions (〜して, 〜いて, 〜って, 〜んで, etc.)
  const result: string[] = [];
  for (const token of tokens) {
    if (token.length <= 1) { result.push(token); continue; }
    const teFormMatch = token.match(/^(.+[しいっん][てで])(.+)$/);
    if (teFormMatch) {
      result.push(teFormMatch[1]);
      result.push(teFormMatch[2]);
    } else {
      result.push(token);
    }
  }

  return result.filter(t => t.length > 0);
}

/** Shuffle array (Fisher-Yates). */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface BlockToken { id: number; text: string; }

// ─── Diff helper (used by free-form mode) ────────────────────────────────────

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
  // ── Mode ──────────────────────────────────────────────────────────────────
  // 'block' = Duolingo-style block clicking; 'freeform' = existing textarea mode
  const [gameMode, setGameMode] = useState<'block' | 'freeform'>('block');

  // ── Block-game state ───────────────────────────────────────────────────────
  const [blockSourceCard, setBlockSourceCard] = useState<Card | null>(null);
  const [blockTarget, setBlockTarget] = useState(''); // correct sentence
  const [availableBlocks, setAvailableBlocks] = useState<BlockToken[]>([]);
  const [placedBlocks, setPlacedBlocks] = useState<BlockToken[]>([]);
  const [blockResult, setBlockResult] = useState<'correct' | 'wrong' | null>(null);
  const [blockStreak, setBlockStreak] = useState(0);

  // ── Free-form state ────────────────────────────────────────────────────────
  const [currentChallenge, setCurrentChallenge] = useState<SentenceChallenge | null>(null);
  const [userAnswer, setUserAnswer] = useState('');
  const [feedback, setFeedback] = useState<{
    score: number;
    feedback: string[];
    isCorrect: boolean;
  } | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [selectedHistoryChallenge, setSelectedHistoryChallenge] = useState<SentenceChallenge | null>(null);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [existingChallenge, setExistingChallenge] = useState<SentenceChallenge | null>(null);
  
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

  // Cards with example sentences (used for block game — no mastered requirement)
  const cardsWithExamples = set.cards.filter(card => getCardExample(card).length > 0);

  // ── Block game initialisation ──────────────────────────────────────────────

  const loadBlockChallenge = (cards: Card[] = cardsWithExamples) => {
    if (cards.length === 0) return;
    const card = cards[Math.floor(Math.random() * cards.length)];
    const example = getCardExample(card);
    const segments = segmentForBlockGame(example);
    if (segments.length < 2) {
      // sentence too short / not segmentable — try another
      const rest = cards.filter(c => c.id !== card.id);
      if (rest.length > 0) { loadBlockChallenge(rest); return; }
    }
    const tokens: BlockToken[] = segments.map((text, i) => ({ id: i, text }));
    setBlockSourceCard(card);
    setBlockTarget(example);
    setAvailableBlocks(shuffle(tokens));
    setPlacedBlocks([]);
    setBlockResult(null);
  };

  useEffect(() => {
    if (gameMode === 'block') {
      loadBlockChallenge();
    } else {
      checkForExistingChallenge();
      loadHistory();
    }
  // `set.id` included so challenges reload when the active set changes.
  // `loadBlockChallenge` / `checkForExistingChallenge` / `loadHistory` are
  // inline helpers that close over the current set; they are stable for a given set.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode, set.id]);

  // ── Block-game handlers ────────────────────────────────────────────────────

  const handleBlockPlace = (token: BlockToken) => {
    if (blockResult) return; // game over, waiting for next
    setAvailableBlocks(prev => prev.filter(b => b.id !== token.id));
    setPlacedBlocks(prev => [...prev, token]);
  };

  const handleBlockRemove = (token: BlockToken) => {
    if (blockResult) return;
    setPlacedBlocks(prev => prev.filter(b => b.id !== token.id));
    setAvailableBlocks(prev => [...prev, token]);
  };

  const handleBlockCheck = () => {
    const assembled = placedBlocks.map(b => b.text).join('');
    const correct =
      assembled.replace(/[。！？.!?、,\s]/g, '') ===
      blockTarget.replace(/[。！？.!?、,\s]/g, '');
    setBlockResult(correct ? 'correct' : 'wrong');
    if (correct) setBlockStreak(s => s + 1);
    else setBlockStreak(0);
  };

  const handleBlockNext = () => {
    loadBlockChallenge();
  };

  // ── Free-form handlers ─────────────────────────────────────────────────────
  
  const checkForExistingChallenge = () => {
    const existing = getCurrentChallenge(set.id);
    if (existing && !existing.userAnswer) {
      setExistingChallenge(existing);
      setShowResumePrompt(true);
    } else {
      loadNewChallenge();
    }
  };
  
  const handleResumeChallenge = () => {
    if (existingChallenge) {
      setCurrentChallenge(existingChallenge);
      setShowResumePrompt(false);
    }
  };
  
  const handleStartNewChallenge = () => {
    if (existingChallenge) {
      clearCurrentChallenge(set.id);
    }
    setShowResumePrompt(false);
    loadNewChallenge();
  };

  const loadNewChallenge = () => {
    if (masteredCards.length < 3) return;
    const challenge = generateChallenge(set.id, masteredCards);
    setCurrentChallenge(challenge);
    setUserAnswer('');
    setFeedback(null);
    setShowCorrectionMode(false);
    setCorrectedAnswer('');
    setDiff([]);
    setSelectedHistoryChallenge(null);
  };

  const loadHistory = () => {
    const challengeHistory = getChallengeHistory(set.id);
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
  
  const handleEditChallenge = (challenge: SentenceChallenge) => {
    setCurrentChallenge(challenge);
    setUserAnswer(challenge.userAnswer || '');
    setFeedback(null);
    setShowCorrectionMode(false);
    setCorrectedAnswer('');
    setDiff([]);
    setSelectedHistoryChallenge(challenge);
    setShowHistory(false);
  };
  
  const handleDeleteChallenge = (challengeId: string) => {
    if (confirm('Are you sure you want to delete this challenge?')) {
      const success = deleteChallenge(set.id, challengeId);
      if (success) {
        loadHistory();
      }
    }
  };

  if (masteredCards.length < 3 && cardsWithExamples.length === 0) {
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
            Add example sentences to your cards or master at least 3 cards to start!
          </p>
          <p style={styles.emptyHint}>Edit a card and add an example sentence on the second line of the "Front" field.</p>
        </div>
      </div>
    );
  }
  
  // Show resume prompt
  if (showResumePrompt && existingChallenge) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={onExit}>← Exit</button>
          <h2 style={styles.headerTitle}>Sentence Builder</h2>
          <div style={{ width: '100px' }} />
        </div>
        <div style={styles.resumePromptContainer}>
          <div style={styles.resumePromptCard}>
            <div style={styles.resumePromptIcon}>📝</div>
            <h3 style={styles.resumePromptTitle}>Resume Session?</h3>
            <p style={styles.resumePromptText}>
              You have an in-progress challenge from earlier.
            </p>
            <div style={styles.resumePromptWords}>
              <strong>Words:</strong> {existingChallenge.words.map(w => w.front.split('[')[0].trim()).join(', ')}
            </div>
            <div style={styles.resumePromptButtons}>
              <button style={styles.resumeButton} onClick={handleResumeChallenge}>
                ↻ Resume Challenge
              </button>
              <button style={styles.newChallengeButton} onClick={handleStartNewChallenge}>
                ✨ Start New Challenge
              </button>
            </div>
          </div>
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
          <h2 style={styles.headerTitle}>Challenge History ({history.length})</h2>
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
                  {entry.feedback && entry.feedback.length > 0 && (
                    <div style={styles.historyFeedback}>
                      <strong>Feedback:</strong> {entry.feedback.join(' ')}
                    </div>
                  )}
                  <div style={styles.historyFooter}>
                    <div style={styles.historyDate}>
                      {new Date(entry.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    <div style={styles.historyActions}>
                      <button 
                        style={styles.editButton}
                        onClick={() => handleEditChallenge(entry)}
                      >
                        ✏️ Edit
                      </button>
                      <button 
                        style={styles.deleteButton}
                        onClick={() => handleDeleteChallenge(entry.challengeId)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  if (!currentChallenge && gameMode === 'freeform') return null;

  // ── Block game render ─────────────────────────────────────────────────────
  if (gameMode === 'block') {
    const frontParts = blockSourceCard ? blockSourceCard.front.split('\n') : [];
    const frontMain = frontParts[0]?.replace(/\[.*?\]/g, '').trim() || '';
    const backMain = blockSourceCard?.back.split('\n')[0] || '';

    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <button style={styles.backButton} onClick={onExit}>← Exit</button>
          <h2 style={styles.headerTitle}>Sentence Builder</h2>
          <div style={styles.modeToggleWrap}>
            <button
              style={{ ...styles.modeTab, ...styles.modeTabActive }}
              onClick={() => setGameMode('block')}
            >🧩 Block</button>
            <button
              style={{ ...styles.modeTab }}
              onClick={() => setGameMode('freeform')}
            >✍️ Free Write</button>
          </div>
        </div>

        <div style={styles.content}>
          {cardsWithExamples.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={styles.emptyIcon}>📝</div>
              <p style={styles.emptyText}>No example sentences found in this set.</p>
              <p style={styles.emptyHint}>Add an example sentence on the second line of a card's "Front" field:<br/>e.g. <code>落ち込む[おちこむ]</code><br/><code>彼は失敗して落ち込む</code></p>
              <button style={styles.switchModeButton} onClick={() => setGameMode('freeform')}>
                Switch to Free Write Mode
              </button>
            </div>
          ) : (
            <div style={styles.blockGameCard}>
              {/* Streak */}
              {blockStreak > 0 && (
                <div style={styles.streakBadge}>🔥 {blockStreak} in a row!</div>
              )}

              {/* Prompt: English meaning */}
              <div style={styles.blockPromptSection}>
                <div style={styles.blockPromptLabel}>Arrange the Japanese sentence:</div>
                {blockSourceCard && (
                  <div style={styles.blockHintBox}>
                    <span style={styles.blockHintWord}>{frontMain}</span>
                    <span style={styles.blockHintSep}> — </span>
                    <span style={styles.blockHintMeaning}>{backMain}</span>
                  </div>
                )}
              </div>

              {/* Answer construction zone */}
              <div style={styles.constructZone}>
                {placedBlocks.length === 0 ? (
                  <div style={styles.constructPlaceholder}>Tap blocks below to build the sentence ↓</div>
                ) : (
                  placedBlocks.map(token => (
                    <button
                      key={token.id}
                      style={{
                        ...styles.blockToken,
                        ...styles.blockTokenPlaced,
                        ...(blockResult === 'correct' ? styles.blockTokenCorrect : {}),
                        ...(blockResult === 'wrong' ? styles.blockTokenWrong : {})
                      }}
                      onClick={() => handleBlockRemove(token)}
                      disabled={blockResult !== null}
                    >
                      {token.text}
                    </button>
                  ))
                )}
              </div>

              {/* Divider */}
              <div style={styles.blockDivider} />

              {/* Available blocks (scrambled) */}
              <div style={styles.availableBlocks}>
                {availableBlocks.map(token => (
                  <button
                    key={token.id}
                    style={{
                      ...styles.blockToken,
                      ...styles.blockTokenAvailable
                    }}
                    onClick={() => handleBlockPlace(token)}
                    disabled={blockResult !== null}
                  >
                    {token.text}
                  </button>
                ))}
              </div>

              {/* Feedback */}
              {blockResult && (
                <div style={{
                  ...styles.blockFeedback,
                  backgroundColor: blockResult === 'correct' ? '#d1fae5' : '#fee2e2',
                  borderColor: blockResult === 'correct' ? '#10b981' : '#ef4444',
                  color: blockResult === 'correct' ? '#065f46' : '#7f1d1d'
                }}>
                  {blockResult === 'correct' ? (
                    <>✅ Correct! <strong>{blockTarget}</strong></>
                  ) : (
                    <>
                      ❌ Not quite. The correct sentence is:<br />
                      <strong style={{ fontSize: 18 }}>{blockTarget}</strong>
                    </>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div style={styles.blockActions}>
                {!blockResult ? (
                  <button
                    style={{
                      ...styles.checkButton,
                      opacity: placedBlocks.length === 0 || availableBlocks.length > 0 ? 0.5 : 1
                    }}
                    disabled={placedBlocks.length === 0 || availableBlocks.length > 0}
                    onClick={handleBlockCheck}
                  >
                    ✓ Check
                  </button>
                ) : (
                  <button style={styles.nextButton} onClick={handleBlockNext}>
                    Next →
                  </button>
                )}
                {!blockResult && (
                  <button style={styles.skipButton} onClick={handleBlockNext}>
                    Skip
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onExit}>← Exit</button>
        <h2 style={styles.headerTitle}>Sentence Builder</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={styles.modeToggleWrap}>
            <button
              style={{ ...styles.modeTab }}
              onClick={() => setGameMode('block')}
            >🧩 Block</button>
            <button
              style={{ ...styles.modeTab, ...styles.modeTabActive }}
              onClick={() => setGameMode('freeform')}
            >✍️ Free Write</button>
          </div>
          <button style={styles.historyButton} onClick={() => setShowHistory(true)}>
            📜 ({history.length})
          </button>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.challengeCard}>
          <div style={styles.challengeHeader}>
            <div style={styles.challengeIcon}>🏗️</div>
            <div style={styles.challengeTitle}>
              {selectedHistoryChallenge ? 'Edit Challenge' : 'Build a Sentence'}
            </div>
          </div>
          
          {selectedHistoryChallenge && (
            <div style={styles.retryBanner}>
              ✏️ Editing previous challenge - Make your improvements!
            </div>
          )}

          <div style={styles.promptSection}>
            <div style={styles.promptLabel}>Prompt:</div>
            <div style={styles.promptText}>{currentChallenge?.prompt}</div>
          </div>

          <div style={styles.wordsSection}>
            <div style={styles.wordsLabel}>Use these words:</div>
            <div style={styles.wordsGrid}>
              {currentChallenge?.words.map((word, idx) => (
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
    padding: '8px 12px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#475569'
  },
  resumePromptContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '32px'
  },
  resumePromptCard: {
    backgroundColor: '#fff',
    borderRadius: '24px',
    padding: '48px',
    maxWidth: '500px',
    textAlign: 'center',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
  },
  resumePromptIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  resumePromptTitle: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#0f172a',
    marginBottom: '12px'
  },
  resumePromptText: {
    fontSize: '16px',
    color: '#64748b',
    marginBottom: '24px'
  },
  resumePromptWords: {
    fontSize: '14px',
    color: '#475569',
    padding: '16px',
    backgroundColor: '#f8fafc',
    borderRadius: '12px',
    marginBottom: '32px'
  },
  resumePromptButtons: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  resumeButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  newChallengeButton: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    padding: '16px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer'
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
  retryBanner: {
    backgroundColor: '#dbeafe',
    border: '2px solid #3b82f6',
    borderRadius: '12px',
    padding: '12px 16px',
    marginBottom: '24px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e40af',
    textAlign: 'center'
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
  historyFeedback: {
    fontSize: '13px',
    color: '#64748b',
    marginBottom: '12px',
    fontStyle: 'italic'
  },
  historyFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #f1f5f9'
  },
  historyDate: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  historyActions: {
    display: 'flex',
    gap: '8px'
  },
  editButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer'
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer'
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
    color: '#94a3b8',
    marginBottom: '16px'
  },
  switchModeButton: {
    marginTop: '16px',
    padding: '12px 24px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer'
  },

  // ── Mode toggle ──────────────────────────────────────────────────────────
  modeToggleWrap: {
    display: 'flex',
    backgroundColor: '#f1f5f9',
    borderRadius: '8px',
    padding: '2px',
    gap: '2px'
  },
  modeTab: {
    border: 'none',
    borderRadius: '6px',
    padding: '6px 12px',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: '#64748b'
  },
  modeTabActive: {
    backgroundColor: '#fff',
    color: '#0f172a',
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
  },

  // ── Block game ─────────────────────────────────────────────────────────────
  blockGameCard: {
    backgroundColor: '#fff',
    borderRadius: '20px',
    padding: '28px 24px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  streakBadge: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: '13px',
    fontWeight: 700,
    padding: '4px 12px',
    borderRadius: '20px'
  },
  blockPromptSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  blockPromptLabel: {
    fontSize: '14px',
    color: '#64748b',
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px'
  },
  blockHintBox: {
    backgroundColor: '#eff6ff',
    borderRadius: '10px',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap' as const
  },
  blockHintWord: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#1e40af'
  },
  blockHintSep: {
    color: '#94a3b8'
  },
  blockHintMeaning: {
    fontSize: '16px',
    color: '#3b82f6'
  },
  constructZone: {
    minHeight: '60px',
    backgroundColor: '#f8fafc',
    border: '2px dashed #cbd5e1',
    borderRadius: '12px',
    padding: '12px',
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    alignItems: 'center'
  },
  constructPlaceholder: {
    color: '#94a3b8',
    fontSize: '14px',
    fontStyle: 'italic' as const
  },
  blockDivider: {
    height: '1px',
    backgroundColor: '#e2e8f0'
  },
  availableBlocks: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '8px',
    minHeight: '48px'
  },
  blockToken: {
    border: 'none',
    borderRadius: '8px',
    padding: '10px 16px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.1s, opacity 0.1s',
    lineHeight: 1.2
  },
  blockTokenAvailable: {
    backgroundColor: '#fff',
    color: '#0f172a',
    boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
    border: '2px solid #e2e8f0'
  },
  blockTokenPlaced: {
    backgroundColor: '#dbeafe',
    color: '#1e40af',
    border: '2px solid #3b82f6'
  },
  blockTokenCorrect: {
    backgroundColor: '#d1fae5',
    color: '#065f46',
    border: '2px solid #10b981'
  },
  blockTokenWrong: {
    backgroundColor: '#fee2e2',
    color: '#7f1d1d',
    border: '2px solid #ef4444'
  },
  blockFeedback: {
    padding: '14px 16px',
    borderRadius: '10px',
    border: '2px solid',
    fontSize: '15px',
    lineHeight: 1.6
  },
  blockActions: {
    display: 'flex',
    gap: '10px'
  },
  checkButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer'
  },
  skipButton: {
    backgroundColor: '#f1f5f9',
    color: '#64748b',
    border: 'none',
    borderRadius: '10px',
    padding: '14px 20px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer'
  }
};

export default SentenceBuilder;

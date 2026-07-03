import React, { useState, useEffect, useCallback, useRef, CSSProperties } from 'react';
import { ensureVocabHydrated, getVocabMap, getVocabStatus } from '../lib/reader/vocabStore';
import { ensurePassagesHydrated } from '../lib/reader/passageStore';
import { getReviewEligibleVocab, findExampleForWord, VOCAB_REVIEW_SET_ID } from '../lib/reader/vocabReview';
import {
  saveCardReview,
  getDueCards,
  getLearningCards,
  getSetReviewData,
  ReviewRating,
} from '../lib/spacedRepetition';
import type { VocabStatus } from '../lib/reader/types';

interface VocabReviewProps {
  onExit: () => void;
}

interface ReviewCard {
  dictionaryForm: string;
  surface: string;
  reading: string;
  sentence?: string;
}

interface DictionarySense {
  englishDefinitions: string[];
  partsOfSpeech: string[];
}

const shuffleArray = <T,>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

function buildCard(v: VocabStatus): ReviewCard {
  return {
    dictionaryForm: v.dictionaryForm,
    surface: v.surface,
    reading: v.reading,
    sentence: findExampleForWord(v.dictionaryForm),
  };
}

function highlightWord(sentence: string, word: string): React.ReactNode {
  const idx = sentence.indexOf(word);
  if (idx < 0) return sentence;
  return (
    <>
      {sentence.slice(0, idx)}
      <strong style={{ color: '#2563eb' }}>{word}</strong>
      {sentence.slice(idx + word.length)}
    </>
  );
}

const VocabReview: React.FC<VocabReviewProps> = ({ onExit }) => {
  const [loading, setLoading] = useState(true);
  const [eligible, setEligible] = useState<VocabStatus[]>([]);
  const [queue, setQueue] = useState<ReviewCard[]>([]);
  const [totalCards, setTotalCards] = useState(0);
  const [currentCard, setCurrentCard] = useState<ReviewCard | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState<'due' | 'all'>('due');
  const [isFinished, setIsFinished] = useState(false);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, mastered: 0 });
  const [graduationToast, setGraduationToast] = useState<string | null>(null);
  const graduationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [dict, setDict] = useState<{ found: boolean; senses: DictionarySense[] } | null>(null);
  const [dictLoading, setDictLoading] = useState(false);

  const loadQueue = useCallback((words: VocabStatus[], mode: 'due' | 'all') => {
    const cards = words.map(buildCard);
    const reviewedData = getSetReviewData(VOCAB_REVIEW_SET_ID);
    const reviewedIds = new Set(reviewedData.map(d => d.cardId));
    const learningIds = new Set(getLearningCards(VOCAB_REVIEW_SET_ID).map(d => d.cardId));
    const dueIds = new Set(getDueCards(VOCAB_REVIEW_SET_ID).map(d => d.cardId));
    const priorityIds = new Set([...learningIds, ...dueIds]);

    let queueCards: ReviewCard[];
    if (mode === 'due') {
      const dueCards = cards.filter(c => priorityIds.has(c.dictionaryForm));
      if (dueCards.length === 0) {
        const newCards = cards.filter(c => !reviewedIds.has(c.dictionaryForm));
        queueCards = shuffleArray(newCards.slice(0, 10));
      } else {
        queueCards = shuffleArray(dueCards);
      }
    } else {
      const priorityCards = cards.filter(c => priorityIds.has(c.dictionaryForm));
      const otherCards = cards.filter(c => !priorityIds.has(c.dictionaryForm));
      queueCards = [...shuffleArray(priorityCards), ...shuffleArray(otherCards)];
    }

    setQueue(queueCards);
    setCurrentCard(queueCards[0] || null);
    setTotalCards(queueCards.length);
    setStudyMode(mode);
    setIsFinished(false);
    setSessionStats({ reviewed: 0, mastered: 0 });
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([ensureVocabHydrated(), ensurePassagesHydrated()]).then(() => {
      if (cancelled) return;
      const words = getReviewEligibleVocab(getVocabMap());
      setEligible(words);

      const reviewedData = getSetReviewData(VOCAB_REVIEW_SET_ID);
      const learningCards = getLearningCards(VOCAB_REVIEW_SET_ID);
      const initialMode = reviewedData.length === 0 || learningCards.length === 0 ? 'all' : 'due';
      loadQueue(words, reviewedData.length > 0 ? initialMode : 'all');
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentCard) {
      setDict(null);
      return;
    }
    let cancelled = false;
    setDict(null);
    setDictLoading(true);
    fetch('/api/dictionary/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: currentCard.dictionaryForm }),
    })
      .then(res => res.json())
      .then(data => { if (!cancelled) setDict(data); })
      .catch(() => { if (!cancelled) setDict({ found: false, senses: [] }); })
      .finally(() => { if (!cancelled) setDictLoading(false); });
    return () => { cancelled = true; };
  }, [currentCard]);

  useEffect(() => {
    return () => {
      if (graduationTimeoutRef.current) clearTimeout(graduationTimeoutRef.current);
    };
  }, []);

  const switchMode = (mode: 'due' | 'all') => {
    setIsFlipped(false);
    loadQueue(eligible, mode);
  };

  const handleReview = (rating: ReviewRating) => {
    if (!currentCard) return;
    // saveCardReview promotes/demotes the word's status internally (see
    // spacedRepetition.ts) — comparing before/after here just detects the
    // graduation moment for the toast, rather than applying it a second time.
    const previousStatus = getVocabStatus(currentCard.dictionaryForm)?.status;
    saveCardReview(VOCAB_REVIEW_SET_ID, currentCard.dictionaryForm, rating);
    const nextStatus = getVocabStatus(currentCard.dictionaryForm)?.status;

    if (previousStatus !== undefined && previousStatus !== 5 && nextStatus === 5) {
      setGraduationToast(currentCard.surface);
      if (graduationTimeoutRef.current) clearTimeout(graduationTimeoutRef.current);
      graduationTimeoutRef.current = setTimeout(() => setGraduationToast(null), 2500);
    }

    setSessionStats(prev => ({
      reviewed: prev.reviewed + 1,
      mastered: prev.mastered + (rating === 'mastered' ? 1 : 0),
    }));

    const newQueue = queue.slice(1);
    const reviewedCard = queue[0];

    if (rating === 'again') {
      const insertIndex = Math.min(newQueue.length, Math.floor(Math.random() * 3) + 2);
      newQueue.splice(insertIndex, 0, reviewedCard);
    } else if (rating === 'know_it') {
      const insertIndex = Math.min(newQueue.length, Math.floor(Math.random() * 3) + 3);
      newQueue.splice(insertIndex, 0, reviewedCard);
    }

    setIsFlipped(false);
    if (newQueue.length === 0) {
      setIsFinished(true);
      setQueue([]);
      setCurrentCard(null);
    } else {
      setQueue(newQueue);
      setCurrentCard(newQueue[0]);
    }
  };

  if (loading) {
    return <div style={styles.centered}>Loading review queue…</div>;
  }

  if (eligible.length === 0) {
    return (
      <div style={styles.centered}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>📭</div>
        <p>No words in a learning stage yet.</p>
        <p style={styles.subText}>Tap words in the Reader and mark them "Learning" to add them here.</p>
        <button style={styles.backLink} onClick={onExit}>← Back to Reader</button>
      </div>
    );
  }

  if (isFinished || !currentCard) {
    return (
      <div style={styles.centered}>
        {graduationToast && (
          <div style={styles.graduationToast}>
            🎉 <strong>{graduationToast}</strong> is now Known!
          </div>
        )}
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>{isFinished ? '🎉' : '✅'}</div>
        <h2 style={{ margin: 0, marginBottom: '8px' }}>
          {isFinished ? 'Session complete!' : 'All caught up!'}
        </h2>
        {isFinished && (
          <p style={styles.subText}>{sessionStats.reviewed} reviewed · {sessionStats.mastered} got it</p>
        )}
        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
          <button style={styles.primaryButton} onClick={() => loadQueue(eligible, studyMode)}>Study Again</button>
          <button style={styles.backLink} onClick={onExit}>← Back to Reader</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {graduationToast && (
        <div style={styles.graduationToast}>
          🎉 <strong>{graduationToast}</strong> is now Known!
        </div>
      )}

      <header style={styles.header}>
        <button style={styles.iconButton} onClick={onExit}>←</button>
        <h1 style={styles.title}>📝 Vocab Review</h1>
        <div style={styles.modeToggle}>
          <button
            style={{ ...styles.modeButton, ...(studyMode === 'due' ? styles.modeButtonActive : {}) }}
            onClick={() => switchMode('due')}
          >
            Due
          </button>
          <button
            style={{ ...styles.modeButton, ...(studyMode === 'all' ? styles.modeButtonActive : {}) }}
            onClick={() => switchMode('all')}
          >
            All
          </button>
        </div>
      </header>

      <div style={styles.counter}>{queue.length} of {totalCards} left</div>

      <div style={styles.cardArea}>
        <div style={styles.flashcard} onClick={() => setIsFlipped(f => !f)}>
          {!isFlipped ? (
            <>
              <div style={styles.cardLabel}>FRONT</div>
              <div style={styles.reading}>{currentCard.reading}</div>
              <div style={styles.sentence}>
                {currentCard.sentence
                  ? highlightWord(currentCard.sentence, currentCard.surface)
                  : <strong style={{ color: '#2563eb' }}>{currentCard.surface}</strong>}
              </div>
              <div style={styles.tapHint}>👆 Tap to see definition</div>
            </>
          ) : (
            <>
              <div style={styles.cardLabel}>BACK</div>
              {dictLoading && <div style={styles.subText}>Looking up…</div>}
              {!dictLoading && dict && !dict.found && <div style={styles.subText}>No dictionary entry found.</div>}
              {!dictLoading && dict?.found && (
                <div style={styles.senses}>
                  {dict.senses.slice(0, 4).map((sense, i) => (
                    <div key={i} style={styles.senseRow}>
                      {sense.partsOfSpeech.length > 0 && (
                        <span style={styles.pos}>{sense.partsOfSpeech.join(', ')}</span>
                      )}
                      <span>{sense.englishDefinitions.join('; ')}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={styles.tapHint}>👆 Tap to flip back</div>
            </>
          )}
        </div>
      </div>

      <div style={styles.actions}>
        <button
          style={{ ...styles.reviewBtn, ...styles.btnAgain, opacity: !isFlipped ? 0.5 : 1 }}
          onClick={() => isFlipped && handleReview('again')}
          disabled={!isFlipped}
        >
          ❌ Forgot
        </button>
        <button
          style={{ ...styles.reviewBtn, ...styles.btnKnowIt, opacity: !isFlipped ? 0.5 : 1 }}
          onClick={() => isFlipped && handleReview('know_it')}
          disabled={!isFlipped}
        >
          🤔 Not sure
        </button>
        <button
          style={{ ...styles.reviewBtn, ...styles.btnMastered, opacity: !isFlipped ? 0.5 : 1 }}
          onClick={() => isFlipped && handleReview('mastered')}
          disabled={!isFlipped}
        >
          ✅ Got it!
        </button>
      </div>
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: { minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' },
  graduationToast: {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    backgroundColor: '#16a34a',
    color: 'white',
    padding: '10px 20px',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: 600,
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    zIndex: 2000,
  },
  centered: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#334155',
    gap: '4px',
    textAlign: 'center',
    padding: '24px',
  },
  subText: { fontSize: '13px', color: '#64748b' },
  backLink: { background: 'none', border: 'none', color: '#3b82f6', fontSize: '14px', cursor: 'pointer', marginTop: '8px' },
  primaryButton: { padding: '10px 20px', border: 'none', borderRadius: '8px', backgroundColor: '#3b82f6', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '8px' },
  header: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b', width: '40px' },
  title: { fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: 0, flex: 1, textAlign: 'center' },
  modeToggle: { display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', borderRadius: '8px', padding: '2px' },
  modeButton: { border: 'none', background: 'none', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: '#64748b' },
  modeButtonActive: { backgroundColor: '#3b82f6', color: 'white' },
  counter: { textAlign: 'center', fontSize: '13px', color: '#64748b', padding: '8px' },
  cardArea: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 24px' },
  flashcard: {
    width: '100%',
    maxWidth: '480px',
    minHeight: '220px',
    backgroundColor: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    border: '2px solid #e2e8f0',
    padding: '28px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: '12px',
  },
  cardLabel: { fontSize: '10px', fontWeight: 700, color: '#64748b', letterSpacing: '1px' },
  reading: { fontSize: '14px', color: '#64748b' },
  sentence: { fontSize: '22px', color: '#0f172a', lineHeight: 1.6 },
  tapHint: { fontSize: '12px', color: '#94a3b8', marginTop: '8px' },
  senses: { display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left', width: '100%' },
  senseRow: { fontSize: '15px', color: '#334155', lineHeight: 1.5 },
  pos: { fontSize: '11px', fontWeight: 600, color: '#3b82f6', marginRight: '6px', textTransform: 'uppercase' },
  actions: { display: 'flex', gap: '8px', padding: '12px 16px', maxWidth: '480px', margin: '0 auto', width: '100%' },
  reviewBtn: { flex: 1, border: 'none', borderRadius: '12px', padding: '14px 6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: '#fff' },
  btnAgain: { backgroundColor: '#ef4444' },
  btnKnowIt: { backgroundColor: '#22c55e' },
  btnMastered: { backgroundColor: '#3b82f6' },
};

export default VocabReview;

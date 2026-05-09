import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { getAllSets, createNewSet, saveSet, getSet } from '../lib/storage';
import { useGenerateSentence } from '../hooks/useGenerateSentence';

const INBOX_DECK_TITLE = 'Inbox';

function getOrCreateInboxDeckId(): string {
  const sets = getAllSets();
  const existing = sets.find(s => s.title === INBOX_DECK_TITLE);
  if (existing) return existing.id;

  const inbox = createNewSet(INBOX_DECK_TITLE, 'Quick-captured words', [], []);
  saveSet(inbox);
  return inbox.id;
}

const QuickCapture: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [source, setSource] = useState('');
  const [showSource, setShowSource] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const wordInputRef = useRef<HTMLInputElement>(null);
  const { generate } = useGenerateSentence();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => wordInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) handleClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  const handleClose = () => {
    setIsOpen(false);
    setWord('');
    setMeaning('');
    setSource('');
    setShowSource(false);
    setSaveStatus('idle');
  };

  const handleSave = async () => {
    const trimmedWord = word.trim();
    if (!trimmedWord) return;

    const deckId = getOrCreateInboxDeckId();
    const deck = getSet(deckId);
    if (!deck) return;

    const cardId = crypto.randomUUID();
    const newCard = {
      id: cardId,
      front: trimmedWord,
      back: meaning.trim() || trimmedWord,
      ...(source.trim() ? { source: source.trim() } : {}),
    } as any;

    const updatedDeck = {
      ...deck,
      cards: [...deck.cards, newCard],
    };
    saveSet(updatedDeck);

    setSaveStatus('saved');

    // Close modal immediately — don't wait for AI
    const capturedWord = trimmedWord;
    const capturedId = cardId;
    handleClose();

    // Background AI generation
    generate(capturedWord).then(result => {
      if (!result) return;
      const latestDeck = getSet(deckId);
      if (!latestDeck) return;
      const updated = {
        ...latestDeck,
        cards: latestDeck.cards.map(c =>
          c.id === capturedId
            ? { ...c, front: result.front, back: result.back }
            : c
        ),
      };
      saveSet(updated);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSave();
  };

  return (
    <>
      {/* Floating button */}
      <button
        style={styles.fab}
        onClick={() => setIsOpen(true)}
        title="Quick capture a word"
        aria-label="Quick capture"
      >
        +
      </button>

      {/* Bottom sheet overlay */}
      {isOpen && (
        <div style={styles.overlay} onClick={handleClose}>
          <div style={styles.sheet} onClick={e => e.stopPropagation()}>
            <div style={styles.handle} />
            <h2 style={styles.title}>⚡ Quick Capture</h2>
            <form onSubmit={handleSubmit}>
              <div style={styles.field}>
                <label style={styles.label}>Word / Phrase</label>
                <input
                  ref={wordInputRef}
                  style={styles.input}
                  type="text"
                  placeholder="e.g. 勉強する"
                  value={word}
                  onChange={e => setWord(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Meaning (optional)</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="e.g. to study"
                  value={meaning}
                  onChange={e => setMeaning(e.target.value)}
                  autoComplete="off"
                />
              </div>

              {/* Collapsible source field */}
              <button
                type="button"
                style={styles.sourceToggle}
                onClick={() => setShowSource(prev => !prev)}
              >
                {showSource ? '▲ Hide source' : '▼ Add source (optional)'}
              </button>
              {showSource && (
                <div style={styles.field}>
                  <input
                    style={styles.input}
                    type="text"
                    placeholder="e.g. Podcast – Luke's English Ep.3"
                    value={source}
                    onChange={e => setSource(e.target.value)}
                    autoComplete="off"
                  />
                </div>
              )}

              <p style={styles.hint}>
                💡 AI will generate an example sentence in the background — no waiting!
              </p>

              <button
                type="submit"
                style={{ ...styles.saveBtn, opacity: word.trim() ? 1 : 0.5 }}
                disabled={!word.trim()}
              >
                💾 Save to Inbox
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

const styles: { [key: string]: CSSProperties } = {
  fab: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    fontSize: '28px',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(59,130,246,0.5)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 2000,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: '24px 24px 0 0',
    padding: '16px 24px 36px',
    width: '100%',
    maxWidth: '480px',
    boxShadow: '0 -4px 24px rgba(0,0,0,0.15)',
  },
  handle: {
    width: '40px',
    height: '4px',
    backgroundColor: '#e2e8f0',
    borderRadius: '2px',
    margin: '0 auto 16px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 20px',
  },
  field: {
    marginBottom: '12px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748b',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '16px',
    border: '2px solid #e2e8f0',
    borderRadius: '10px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    color: '#0f172a',
  },
  sourceToggle: {
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0 0 12px 0',
    textAlign: 'left' as const,
  },
  hint: {
    fontSize: '12px',
    color: '#94a3b8',
    margin: '8px 0 16px',
  },
  saveBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};

export default QuickCapture;

import React, { useState, CSSProperties } from 'react';
import { getSet, saveSet, CardDraft, FlashcardSet } from '../lib/storage';
import { useGenerateSentence } from '../hooks/useGenerateSentence';

interface EditSetProps {
  setId: string;
  onNavigateToHome: () => void;
}

type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | undefined;

const EditSet: React.FC<EditSetProps> = ({ setId, onNavigateToHome }) => {
  const existingSet = getSet(setId);

  const [title, setTitle] = useState(existingSet?.title ?? '');
  const [description, setDescription] = useState(existingSet?.description ?? '');
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>(existingSet?.jlptLevel);
  const [cards, setCards] = useState<CardDraft[]>(
    existingSet?.cards.length
      ? existingSet.cards.map(c => ({ id: c.id, front: c.front, back: c.back, example: c.example }))
      : [{ id: crypto.randomUUID(), front: '', back: '' }]
  );

  const { generate, isGenerating, error: generateError } = useGenerateSentence();
  const [vocabWords, setVocabWords] = useState<Record<string, string>>({});

  if (!existingSet) {
    return (
      <div style={styles.container}>
        <p style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Set not found.</p>
        <button style={styles.closeButton} onClick={onNavigateToHome}>← Back</button>
      </div>
    );
  }

  const handleAutoFill = async (cardId: string) => {
    const word = vocabWords[cardId] ?? '';
    if (!word.trim()) return;
    const result = await generate(word);
    if (result) {
      setCards(cards.map(card =>
        card.id === cardId ? { ...card, front: result.front, back: result.back } : card
      ));
      setVocabWords(prev => ({ ...prev, [cardId]: '' }));
    }
  };

  const handleAddCard = () => {
    setCards([...cards, { id: crypto.randomUUID(), front: '', back: '' }]);
  };

  const handleUpdateCard = (id: string, field: 'front' | 'back', value: string) => {
    setCards(cards.map(card =>
      card.id === id ? { ...card, [field]: value } : card
    ));
  };

  const handleDeleteCard = (id: string) => {
    if (cards.length > 1) {
      setCards(cards.filter(card => card.id !== id));
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('Please enter a title for your flashcard set');
      return;
    }

    const validCards = cards.filter(card => card.front.trim() && card.back.trim());
    if (validCards.length === 0) {
      alert('Please add at least one complete card (both front and back)');
      return;
    }

    const updatedSet: FlashcardSet = {
      ...existingSet,
      title: title.trim(),
      description: description.trim(),
      jlptLevel,
      cards: validCards.map(c => ({ id: c.id, front: c.front, back: c.back, ...(c.example ? { example: c.example } : {}) })),
      updatedAt: Date.now()
    };

    saveSet(updatedSet);
    onNavigateToHome();
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button
          style={styles.closeButton}
          onClick={onNavigateToHome}
          aria-label="Cancel editing"
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          ✕
        </button>
        <h1 style={styles.title}>Edit Set</h1>
        <button
          style={styles.saveButton}
          onClick={handleSave}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Save
        </button>
      </header>

      <div style={styles.content}>
        <section style={styles.section}>
          <input
            type="text"
            placeholder="Enter title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={styles.titleInput}
            autoFocus
          />
          <textarea
            placeholder="Add a description (optional)..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={styles.descriptionInput}
            rows={3}
          />

          <div style={styles.levelSelectorContainer}>
            <label style={styles.levelLabel}>JLPT Level (Optional)</label>
            <select
              value={jlptLevel || ''}
              onChange={(e) => setJlptLevel(e.target.value as JLPTLevel || undefined)}
              style={styles.levelSelect}
            >
              <option value="">Custom / No Level</option>
              <option value="N5">N5 (Beginner)</option>
              <option value="N4">N4 (Elementary)</option>
              <option value="N3">N3 (Intermediate)</option>
              <option value="N2">N2 (Upper-Intermediate)</option>
              <option value="N1">N1 (Advanced)</option>
            </select>
          </div>
        </section>

        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Cards</h2>
          {cards.map((card, index) => (
            <div key={card.id} style={styles.cardEditor}>
              <div style={styles.cardEditorHeader}>
                <span style={styles.cardNumber}>Card {index + 1}</span>
                {cards.length > 1 && (
                  <button
                    style={styles.deleteCardButton}
                    onClick={() => handleDeleteCard(card.id)}
                    aria-label="Delete card"
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                  >
                    🗑️
                  </button>
                )}
              </div>
              <div style={styles.autoFillContainer}>
                <label style={styles.autoFillLabel}>
                  Japanese vocab (auto-fill)
                </label>
                <div style={styles.autoFillRow}>
                  <input
                    type="text"
                    value={vocabWords[card.id] ?? ''}
                    onChange={(e) => setVocabWords(prev => ({ ...prev, [card.id]: e.target.value }))}
                    placeholder="e.g. 食べる"
                    style={styles.vocabInput}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAutoFill(card.id);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAutoFill(card.id)}
                    disabled={!(vocabWords[card.id] ?? '').trim() || isGenerating}
                    style={{
                      ...styles.autoFillButton,
                      background: isGenerating ? '#ccc' : '#4f46e5',
                      cursor: isGenerating ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isGenerating ? '⏳ Generating...' : '✨ Auto-fill'}
                  </button>
                </div>
                {generateError && (
                  <p style={styles.autoFillError}>{generateError}</p>
                )}
              </div>
              <textarea
                placeholder="Front (Term/Question)"
                value={card.front}
                onChange={(e) => handleUpdateCard(card.id, 'front', e.target.value)}
                style={styles.cardInput}
                rows={2}
              />
              <textarea
                placeholder="Back (Definition/Answer)"
                value={card.back}
                onChange={(e) => handleUpdateCard(card.id, 'back', e.target.value)}
                style={styles.cardInput}
                rows={2}
              />
            </div>
          ))}
          <button
            style={styles.addCardButton}
            onClick={handleAddCard}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.borderColor = '#3b82f6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            + Add Card
          </button>
        </section>
      </div>
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc'
  },
  header: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'sticky',
    top: 0,
    zIndex: 10
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#64748b',
    padding: '4px 8px',
    transition: 'opacity 0.2s'
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 24px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  content: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '24px'
  },
  section: {
    marginBottom: '32px'
  },
  titleInput: {
    width: '100%',
    fontSize: '24px',
    fontWeight: 600,
    padding: '16px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    marginBottom: '16px',
    outline: 'none',
    transition: 'border-color 0.2s',
    backgroundColor: '#fff',
    boxSizing: 'border-box'
  },
  descriptionInput: {
    width: '100%',
    fontSize: '16px',
    padding: '12px 16px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
    backgroundColor: '#fff',
    boxSizing: 'border-box',
    marginBottom: '16px'
  },
  levelSelectorContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  levelLabel: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#475569'
  },
  levelSelect: {
    width: '100%',
    padding: '12px 16px',
    fontSize: '16px',
    border: '2px solid #e2e8f0',
    borderRadius: '12px',
    backgroundColor: '#fff',
    color: '#0f172a',
    cursor: 'pointer',
    outline: 'none',
    transition: 'border-color 0.2s',
    fontFamily: 'inherit'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '16px'
  },
  cardEditor: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '16px',
    border: '1px solid #e2e8f0'
  },
  cardEditorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  cardNumber: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#64748b'
  },
  deleteCardButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
    opacity: 0.6,
    transition: 'opacity 0.2s'
  },
  cardInput: {
    width: '100%',
    fontSize: '14px',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    marginBottom: '8px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box'
  },
  addCardButton: {
    width: '100%',
    padding: '16px',
    border: '2px dashed #cbd5e1',
    borderRadius: '12px',
    backgroundColor: 'transparent',
    color: '#3b82f6',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  autoFillContainer: {
    marginBottom: '12px'
  },
  autoFillLabel: {
    display: 'block',
    marginBottom: '4px',
    fontSize: '13px',
    fontWeight: 600,
    color: '#64748b'
  },
  autoFillRow: {
    display: 'flex',
    gap: '8px'
  },
  vocabInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '15px',
    fontFamily: 'inherit',
    outline: 'none'
  },
  autoFillButton: {
    padding: '8px 16px',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    transition: 'background 0.2s'
  },
  autoFillError: {
    color: '#dc2626',
    fontSize: '13px',
    marginTop: '4px',
    marginBottom: 0
  }
};

export default EditSet;

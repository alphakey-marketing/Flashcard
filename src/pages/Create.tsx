import React, { useState, CSSProperties } from 'react';
import { createNewSet, saveSet, CardDraft } from '../lib/storage';
import { useGenerateSentence } from '../hooks/useGenerateSentence';
import { extractVocab, ExtractedVocab } from '../lib/vocabExtractor';

interface CreateProps {
  onNavigateToHome: () => void;
}

type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | undefined;

const Create: React.FC<CreateProps> = ({ onNavigateToHome }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [jlptLevel, setJlptLevel] = useState<JLPTLevel>(undefined);
  const [cards, setCards] = useState<CardDraft[]>([
    { id: crypto.randomUUID(), front: '', back: '' },
    { id: crypto.randomUUID(), front: '', back: '' }
  ]);

  const { generate, isGenerating, error: generateError } = useGenerateSentence();
  const [vocabWords, setVocabWords] = useState<Record<string, string>>({});

  // ── Vocab extract panel state ──────────────────────────────────────────────
  const [extractOpen, setExtractOpen] = useState(false);
  const [extractText, setExtractText] = useState('');
  const [extractedVocab, setExtractedVocab] = useState<ExtractedVocab[]>([]);
  const [showCommonWords, setShowCommonWords] = useState(false);
  const [selectedVocabIds, setSelectedVocabIds] = useState<Set<string>>(new Set());
  const [generatingVocabId, setGeneratingVocabId] = useState<string | null>(null);
  const [vocabError, setVocabError] = useState<string | null>(null);
  const [generateAllProgress, setGenerateAllProgress] = useState<{ current: number; total: number } | null>(null);

  const handleAddCard = () => {
    setCards([...cards, { id: crypto.randomUUID(), front: '', back: '' }]);
  };

  const handleUpdateCard = (id: string, field: 'front' | 'back' | 'source', value: string) => {
    setCards(cards.map(card => 
      card.id === id ? { ...card, [field]: value } : card
    ));
  };

  const handleDeleteCard = (id: string) => {
    if (cards.length > 1) {
      setCards(cards.filter(card => card.id !== id));
    }
  };

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

  // ── Vocab extract handlers ─────────────────────────────────────────────────
  const handleExtract = () => {
    const text = extractText.trim();
    if (!text) return;
    const vocab = extractVocab(text);
    setExtractedVocab(vocab);
    setSelectedVocabIds(new Set(vocab.filter(v => !v.isCommon).map(v => v.id)));
    setVocabError(null);
  };

  const toggleVocabSelect = (id: string) => {
    setSelectedVocabIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleGenerateForVocab = async (vocabId: string) => {
    const item = extractedVocab.find(v => v.id === vocabId);
    if (!item || isGenerating || generateAllProgress !== null) return;
    setGeneratingVocabId(vocabId);
    setVocabError(null);
    const result = await generate(item.word);
    setGeneratingVocabId(null);
    if (result) {
      setExtractedVocab(prev =>
        prev.map(v =>
          v.id === vocabId
            ? {
                ...v,
                front: result.front,
                back: result.back,
                reading: result.reading ?? '',
                meaning: result.meaning ?? '',
                isGenerated: true,
              }
            : v
        )
      );
    } else if (generateError) {
      setVocabError(generateError);
    }
  };

  /** Generate AI flashcards for all selected words then add them to the set. */
  const handleGenerateAllAndAdd = async () => {
    const selected = extractedVocab.filter(v => selectedVocabIds.has(v.id));
    if (selected.length === 0 || generateAllProgress !== null) return;
    setGenerateAllProgress({ current: 0, total: selected.length });
    setVocabError(null);

    const resultsMap = new Map<string, { front: string; back: string; reading: string; meaning: string }>();
    let failCount = 0;

    for (let i = 0; i < selected.length; i++) {
      const item = selected[i];
      setGenerateAllProgress({ current: i + 1, total: selected.length });
      const result = await generate(item.word);
      if (result) {
        const generated = {
          front: result.front,
          back: result.back,
          reading: result.reading ?? '',
          meaning: result.meaning ?? '',
        };
        resultsMap.set(item.id, generated);
        setExtractedVocab(prev =>
          prev.map(v =>
            v.id === item.id
              ? { ...v, ...generated, isGenerated: true }
              : v
          )
        );
      } else {
        failCount++;
      }
    }

    const newCards: CardDraft[] = selected.map(v => {
      const fresh = resultsMap.get(v.id);
      if (fresh) {
        return { id: crypto.randomUUID(), front: fresh.front, back: fresh.back, example: v.exampleSentence || undefined };
      }
      if (v.isGenerated) {
        return { id: crypto.randomUUID(), front: v.front, back: v.back, example: v.exampleSentence || undefined };
      }
      return { id: crypto.randomUUID(), front: v.word, back: '', example: v.exampleSentence || undefined };
    });

    setCards(prev => [...newCards, ...prev]);
    setExtractedVocab([]);
    setSelectedVocabIds(new Set());
    setExtractText('');
    setGenerateAllProgress(null);
    if (failCount > 0) {
      setVocabError(`${failCount} word${failCount > 1 ? 's' : ''} could not be generated — added with blank back side.`);
    }
  };

  const handleAddSelectedToSet = () => {
    const selected = extractedVocab.filter(v => selectedVocabIds.has(v.id));
    if (selected.length === 0) return;
    const newCards: CardDraft[] = selected.map(v => ({
      id: crypto.randomUUID(),
      front: v.isGenerated ? v.front : v.word,
      back: v.isGenerated ? v.back : '',
      example: v.exampleSentence || undefined,
    }));
    // Prepend to top of card list (add-at-top behaviour)
    setCards(prev => [...newCards, ...prev]);
    // Reset panel
    setExtractedVocab([]);
    setSelectedVocabIds(new Set());
    setExtractText('');
  };

  const handleSave = () => {
    // Validation
    if (!title.trim()) {
      alert('Please enter a title for your flashcard set');
      return;
    }

    const validCards = cards.filter(card => card.front.trim() && card.back.trim());
    if (validCards.length === 0) {
      alert('Please add at least one complete card (both front and back)');
      return;
    }

    // Create and save set
    const newSet = createNewSet(title.trim(), description.trim(), validCards, [], jlptLevel);
    saveSet(newSet);
    onNavigateToHome();
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button
          style={styles.closeButton}
          onClick={onNavigateToHome}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          ✕
        </button>
        <h1 style={styles.title}>New Set</h1>
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
        {/* ── Vocab extract panel ─────────────────────────────────────────── */}
        <div style={styles.extractPanel}>
          <button
            style={styles.extractToggle}
            onClick={() => setExtractOpen(o => !o)}
            aria-expanded={extractOpen}
          >
            <span>📖 Extract vocab from text</span>
            <span style={styles.extractToggleIcon}>{extractOpen ? '▲' : '▼'}</span>
          </button>

          {extractOpen && (
            <div style={styles.extractBody}>
              <textarea
                style={styles.extractTextarea}
                rows={5}
                placeholder="Paste a Japanese paragraph here and press Extract…"
                value={extractText}
                onChange={e => setExtractText(e.target.value)}
              />
              <div style={styles.extractControls}>
                <button
                  style={styles.extractButton}
                  onClick={handleExtract}
                  disabled={!extractText.trim()}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  Extract
                </button>
                <label style={styles.extractToggleLabel}>
                  <input
                    type="checkbox"
                    checked={showCommonWords}
                    onChange={e => setShowCommonWords(e.target.checked)}
                    style={{ marginRight: '6px' }}
                  />
                  Show common words
                </label>
              </div>

              {vocabError && <p style={styles.extractError}>{vocabError}</p>}

              {extractedVocab.length > 0 && (() => {
                const visible = extractedVocab.filter(v => showCommonWords || !v.isCommon);
                const hiddenCount = extractedVocab.filter(v => v.isCommon).length;
                const selCount = visible.filter(v => selectedVocabIds.has(v.id)).length;
                return (
                  <>
                    <p style={styles.extractSummary}>
                      Found <strong>{extractedVocab.length}</strong> words
                      {!showCommonWords && hiddenCount > 0 && ` (${hiddenCount} common hidden)`}
                    </p>

                    <div style={styles.extractList}>
                      {visible.map(item => (
                        <div
                          key={item.id}
                          style={{
                            ...styles.extractRow,
                            ...(selectedVocabIds.has(item.id) ? styles.extractRowSelected : {}),
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedVocabIds.has(item.id)}
                            onChange={() => toggleVocabSelect(item.id)}
                            style={styles.extractCheckbox}
                          />
                          <div style={styles.extractRowMain}>
                            <div style={styles.extractWord}>
                              {item.word}
                              {item.isCommon && (
                                <span style={styles.extractCommonBadge}>common</span>
                              )}
                            </div>
                            {item.isGenerated ? (
                              <div style={styles.extractMeta}>
                                <span style={styles.extractReading}>{item.reading}</span>
                                <span style={styles.extractMeaning}>{item.meaning}</span>
                              </div>
                            ) : (
                              <div style={styles.extractMeta}>
                                <span style={{ color: '#94a3b8', fontSize: '12px' }}>—</span>
                              </div>
                            )}
                            {item.exampleSentence && (
                              <div style={styles.extractExample}>
                                例: {item.exampleSentence.length > 60
                                  ? item.exampleSentence.slice(0, 60) + '…'
                                  : item.exampleSentence}
                              </div>
                            )}
                          </div>
                          <button
                            style={{
                              ...styles.extractGenerateBtn,
                              ...(item.isGenerated ? styles.extractGenerateBtnDone : {}),
                              opacity: (isGenerating || generateAllProgress !== null) && generatingVocabId !== item.id ? 0.5 : 1,
                              cursor: (isGenerating || generateAllProgress !== null) && generatingVocabId !== item.id ? 'not-allowed' : 'pointer',
                            }}
                            onClick={() => handleGenerateForVocab(item.id)}
                            disabled={isGenerating || generateAllProgress !== null}
                            title={item.isGenerated ? 'Re-generate' : 'Generate reading & meaning'}
                          >
                            {generatingVocabId === item.id ? '⏳' : item.isGenerated ? '✓' : '✨'}
                          </button>
                        </div>
                      ))}
                    </div>

                    <button
                      style={{
                        ...styles.extractAddButton,
                        opacity: selCount === 0 || generateAllProgress !== null ? 0.5 : 1,
                        cursor: selCount === 0 || generateAllProgress !== null ? 'not-allowed' : 'pointer',
                      }}
                      onClick={handleGenerateAllAndAdd}
                      disabled={selCount === 0 || generateAllProgress !== null}
                      onMouseEnter={e => selCount > 0 && generateAllProgress === null && (e.currentTarget.style.opacity = '0.9')}
                      onMouseLeave={e => selCount > 0 && generateAllProgress === null && (e.currentTarget.style.opacity = '1')}
                    >
                      {generateAllProgress !== null
                        ? `⏳ Generating ${generateAllProgress.current}/${generateAllProgress.total}…`
                        : `✨ Auto-generate & Add ${selCount} card${selCount !== 1 ? 's' : ''} to set`}
                    </button>
                    <button
                      style={{
                        ...styles.extractAddSecondary,
                        opacity: selCount === 0 || generateAllProgress !== null ? 0.4 : 0.7,
                        cursor: selCount === 0 || generateAllProgress !== null ? 'not-allowed' : 'pointer',
                      }}
                      onClick={handleAddSelectedToSet}
                      disabled={selCount === 0 || generateAllProgress !== null}
                      onMouseEnter={e => selCount > 0 && generateAllProgress === null && (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => selCount > 0 && generateAllProgress === null && (e.currentTarget.style.opacity = '0.7')}
                    >
                      Add selected without AI →
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </div>
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
          
          {/* JLPT Level Selector */}
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
              <input
                type="text"
                placeholder="Source (optional, e.g. Podcast – Luke's English Ep.3)"
                value={card.source ?? ''}
                onChange={(e) => handleUpdateCard(card.id, 'source', e.target.value)}
                style={{ ...styles.cardInput, fontSize: '13px', color: '#64748b', padding: '8px 12px' } as CSSProperties}
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
  },
  // ── Vocab extract panel styles ───────────────────────────────────────────
  extractPanel: {
    marginBottom: '24px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    backgroundColor: '#fff'
  },
  extractToggle: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 600,
    color: '#0f172a',
    fontFamily: 'inherit'
  },
  extractToggleIcon: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  extractBody: {
    padding: '0 20px 20px'
  },
  extractTextarea: {
    width: '100%',
    fontSize: '14px',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    marginBottom: '10px'
  },
  extractControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '12px'
  },
  extractButton: {
    padding: '8px 20px',
    backgroundColor: '#4f46e5',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  extractToggleLabel: {
    fontSize: '13px',
    color: '#64748b',
    display: 'flex',
    alignItems: 'center',
    cursor: 'pointer'
  },
  extractError: {
    color: '#dc2626',
    fontSize: '13px',
    marginBottom: '8px'
  },
  extractSummary: {
    fontSize: '13px',
    color: '#64748b',
    marginBottom: '10px'
  },
  extractList: {
    maxHeight: '340px',
    overflowY: 'auto',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    marginBottom: '12px'
  },
  extractRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '10px 12px',
    borderBottom: '1px solid #f1f5f9',
    transition: 'background 0.15s'
  },
  extractRowSelected: {
    backgroundColor: '#f0f9ff'
  },
  extractCheckbox: {
    marginTop: '3px',
    flexShrink: 0,
    cursor: 'pointer'
  },
  extractRowMain: {
    flex: 1,
    minWidth: 0
  },
  extractWord: {
    fontSize: '15px',
    fontWeight: 700,
    color: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '2px'
  },
  extractCommonBadge: {
    fontSize: '10px',
    fontWeight: 600,
    color: '#94a3b8',
    backgroundColor: '#f1f5f9',
    borderRadius: '4px',
    padding: '1px 5px'
  },
  extractMeta: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '2px'
  },
  extractReading: {
    fontSize: '12px',
    color: '#3b82f6',
    fontWeight: 500
  },
  extractMeaning: {
    fontSize: '12px',
    color: '#475569'
  },
  extractExample: {
    fontSize: '12px',
    color: '#94a3b8',
    fontStyle: 'italic',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  extractGenerateBtn: {
    flexShrink: 0,
    padding: '5px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    backgroundColor: '#f8fafc',
    color: '#475569',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  extractGenerateBtnDone: {
    borderColor: '#10b981',
    color: '#10b981',
    backgroundColor: '#f0fdf4'
  },
  extractAddButton: {
    width: '100%',
    padding: '11px',
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    marginBottom: '8px'
  },
  extractAddSecondary: {
    width: '100%',
    padding: '8px',
    backgroundColor: 'transparent',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  }
};

export default Create;

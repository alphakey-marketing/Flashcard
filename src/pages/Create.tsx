import React, { useState, CSSProperties } from 'react';
import { createNewSet, saveSet, CardDraft } from '../lib/storage';
import { useGenerateSentence } from '../hooks/useGenerateSentence';
import { extractVocab, extractVocabWithAI, ExtractedVocab } from '../lib/vocabExtractor';

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
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractMethod, setExtractMethod] = useState<'ai' | 'fallback' | null>(null);

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
  const handleExtract = async () => {
    const text = extractText.trim();
    if (!text) return;
    setIsExtracting(true);
    setExtractMethod(null);
    setVocabError(null);

    try {
      const words = await extractVocabWithAI(text);
      if (words.length === 0) throw new Error('empty_result');
      setExtractedVocab(words);
      setExtractMethod('ai');
    } catch (err: unknown) {
      console.warn('[Extract] AI unavailable, falling back to regex:', err instanceof Error ? err.message : err);
      const words = extractVocab(text);
      setExtractedVocab(words);
      setExtractMethod('fallback');
    } finally {
      setIsExtracting(false);
      setSelectedVocabIds(new Set());
    }
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
                  style={{
                    ...styles.extractButton,
                    opacity: !extractText.trim() || isExtracting ? 0.6 : 1,
                    cursor: !extractText.trim() || isExtracting ? 'not-allowed' : 'pointer',
                  }}
                  onClick={handleExtract}
                  disabled={!extractText.trim() || isExtracting}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  {isExtracting ? '⏳ Analysing…' : 'Extract'}
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

              {extractMethod === 'fallback' && (
                <div style={styles.extractFallbackNotice}>
                  ⚡ Quick extract (AI unavailable) — JLPT levels not shown
                </div>
              )}

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
                      {extractMethod === 'ai' && <span style={styles.extractAiBadge}>✨ AI</span>}
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
                              {item.jlptLevel && item.jlptLevel !== 'unknown' && (
                                <span style={{
                                  ...styles.jlptBadge,
                                  ...jlptBadgeColor(item.jlptLevel),
                                }}>
                                  {item.jlptLevel}
                                </span>
                              )}
                            </div>
                            {item.isGenerated ? (
                              <div style={styles.extractMeta}>
                                <span style={styles.extractReading}>{item.reading}</span>
                                <span style={styles.extractMeaning}>{item.meaning}</span>
                              </div>
                            ) : item.extractedByAI && item.reading ? (
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
       
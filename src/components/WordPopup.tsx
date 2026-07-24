import React, { useState, useEffect, CSSProperties } from 'react';
import type { Token, VocabStatusValue } from '../lib/reader/types';
import { getVocabStatus, setVocabStatus, updateVocabNote, STATUS_LABELS } from '../lib/reader/vocabStore';
import { authHeader, quotaErrorMessage } from '../lib/authHeader';

interface WordPopupProps {
  token: Token;
  sentence: string;
  passageId: string;
  onClose: () => void;
  /** Called after a status change so the Reader can re-render token colors. */
  onStatusChange: () => void;
}

interface DictionarySense {
  englishDefinitions: string[];
  partsOfSpeech: string[];
}

interface DictionaryResult {
  found: boolean;
  headword: string;
  readings: string[];
  senses: DictionarySense[];
}

const STATUS_ORDER: VocabStatusValue[] = [0, 1, 2, 3, 4, 5, 99];

const WordPopup: React.FC<WordPopupProps> = ({ token, sentence, passageId, onClose, onStatusChange }) => {
  const [dict, setDict] = useState<DictionaryResult | null>(null);
  const [dictLoading, setDictLoading] = useState(true);
  const [dictError, setDictError] = useState('');

  const [translation, setTranslation] = useState<{ translation: string; wordExplanation: string | null } | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState('');

  const [currentStatus, setCurrentStatus] = useState<VocabStatusValue>(
    () => getVocabStatus(token.dictionaryForm)?.status ?? 0
  );
  const [note, setNote] = useState(() => getVocabStatus(token.dictionaryForm)?.note ?? '');

  // Popup itself renders instantly (within the 300ms budget) — the dictionary
  // lookup fills in asynchronously behind a loading state.
  useEffect(() => {
    let cancelled = false;
    setDict(null);
    setDictLoading(true);
    setDictError('');

    fetch('/api/dictionary/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: token.dictionaryForm }),
    })
      .then(res => res.json())
      .then(data => {
        if (!cancelled) setDict(data);
      })
      .catch(err => {
        if (!cancelled) setDictError(err.message || 'Lookup failed');
      })
      .finally(() => {
        if (!cancelled) setDictLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token.dictionaryForm]);

  const handleStatusClick = (status: VocabStatusValue) => {
    setVocabStatus(
      { dictionaryForm: token.dictionaryForm, surface: token.surface, reading: token.reading },
      status,
      { sourcePassageId: passageId }
    );
    setCurrentStatus(status);
    onStatusChange();
  };

  const handleNoteBlur = () => {
    updateVocabNote(token.dictionaryForm, note);
  };

  const handleTranslate = async () => {
    setTranslating(true);
    setTranslateError('');
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeader()) };
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers,
        body: JSON.stringify({ sentence, targetWord: token.surface }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(quotaErrorMessage(data.error) ?? data.error ?? 'Translation failed');
      setTranslation(data);
    } catch (err: any) {
      setTranslateError(err.message || 'Translation failed');
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.card} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <div style={styles.surface}>{token.surface}</div>
            <div style={styles.reading}>{token.reading}</div>
          </div>
          <button style={styles.closeButton} onClick={onClose}>✕</button>
        </div>

        <div style={styles.body}>
          {dictLoading && <div style={styles.loading}>Looking up…</div>}
          {dictError && <div style={styles.error}>{dictError}</div>}
          {dict && !dict.found && <div style={styles.loading}>No dictionary entry found.</div>}
          {dict && dict.found && (
            <div style={styles.senses}>
              {dict.senses.slice(0, 5).map((sense, i) => (
                <div key={i} style={styles.senseRow}>
                  {sense.partsOfSpeech.length > 0 && (
                    <span style={styles.pos}>{sense.partsOfSpeech.join(', ')}</span>
                  )}
                  <span>{sense.englishDefinitions.join('; ')}</span>
                </div>
              ))}
            </div>
          )}

          <div style={styles.sentenceBox}>{sentence}</div>

          {!translation && (
            <button style={styles.translateButton} onClick={handleTranslate} disabled={translating}>
              {translating ? 'Translating…' : '✨ Translate this sentence'}
            </button>
          )}
          {translateError && <div style={styles.error}>{translateError}</div>}
          {translation && (
            <div style={styles.translationBox}>
              <div>{translation.translation}</div>
              {translation.wordExplanation && (
                <div style={styles.wordExplanation}>{translation.wordExplanation}</div>
              )}
            </div>
          )}

          <div style={styles.sectionLabel}>Status</div>
          <div style={styles.statusGrid}>
            {STATUS_ORDER.map(status => (
              <button
                key={status}
                style={{
                  ...styles.statusButton,
                  ...(status === currentStatus ? styles.statusButtonActive : {}),
                }}
                onClick={() => handleStatusClick(status)}
              >
                {STATUS_LABELS[status]}
              </button>
            ))}
          </div>

          <div style={styles.sectionLabel}>Note / mnemonic</div>
          <textarea
            style={styles.noteInput}
            value={note}
            onChange={e => setNote(e.target.value)}
            onBlur={handleNoteBlur}
            rows={2}
            placeholder="Add a personal note or mnemonic…"
          />
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '16px 16px 0 0',
    width: '100%',
    maxWidth: '480px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 -8px 30px rgba(0,0,0,0.25)',
  },
  header: {
    padding: '20px 24px 12px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  surface: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#0f172a',
  },
  reading: {
    fontSize: '14px',
    color: '#64748b',
    marginTop: '4px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    color: '#64748b',
  },
  body: {
    padding: '16px 24px 24px',
    overflowY: 'auto',
  },
  loading: {
    fontSize: '14px',
    color: '#94a3b8',
    marginBottom: '12px',
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    padding: '10px 12px',
    borderRadius: '8px',
    fontSize: '13px',
    marginBottom: '12px',
  },
  senses: {
    marginBottom: '16px',
  },
  senseRow: {
    fontSize: '14px',
    color: '#334155',
    marginBottom: '6px',
    lineHeight: 1.5,
  },
  pos: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#3b82f6',
    marginRight: '6px',
    textTransform: 'uppercase',
  },
  sentenceBox: {
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '15px',
    color: '#1e293b',
    marginBottom: '12px',
    lineHeight: 1.7,
  },
  translateButton: {
    width: '100%',
    padding: '10px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#eff6ff',
    color: '#2563eb',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginBottom: '12px',
  },
  translationBox: {
    backgroundColor: '#eff6ff',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    color: '#1e3a8a',
    marginBottom: '16px',
    lineHeight: 1.5,
  },
  wordExplanation: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#3730a3',
    fontStyle: 'italic',
  },
  sectionLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: '8px',
    marginTop: '4px',
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
    gap: '8px',
    marginBottom: '16px',
  },
  statusButton: {
    padding: '8px 10px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: '#fff',
    color: '#334155',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  statusButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
  },
  noteInput: {
    width: '100%',
    padding: '10px 12px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    boxSizing: 'border-box',
  },
};

export default WordPopup;

import React, { useState, CSSProperties } from 'react';
import { getTemplateSetsForLevel, seedSelectedTemplates, markLevelOnboardingDone } from '../lib/storage';
import type { FlashcardSet } from '../lib/storage';

interface LevelPickerProps {
  onDone: () => void;
}

type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1';

const LEVELS: { level: JLPTLevel; label: string; hint: string; hasContent: boolean }[] = [
  { level: 'N5', label: 'N5', hint: 'Just starting out', hasContent: true },
  { level: 'N4', label: 'N4', hint: 'Know the basics', hasContent: true },
  { level: 'N3', label: 'N3', hint: 'Intermediate', hasContent: false },
  { level: 'N2', label: 'N2', hint: 'Upper intermediate', hasContent: false },
  { level: 'N1', label: 'N1', hint: 'Advanced', hasContent: false },
];

const LevelPicker: React.FC<LevelPickerProps> = ({ onDone }) => {
  const [step, setStep] = useState<'level' | 'sets'>('level');
  const [chosenLevel, setChosenLevel] = useState<JLPTLevel | null>(null);
  const [availableSets, setAvailableSets] = useState<FlashcardSet[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const handlePickLevel = (level: JLPTLevel) => {
    const sets = getTemplateSetsForLevel(level);
    if (sets.length === 0) {
      // No starter content for this level yet — nothing to choose from, just finish onboarding.
      markLevelOnboardingDone();
      onDone();
      return;
    }
    setChosenLevel(level);
    setAvailableSets(sets);
    setSelectedIds(new Set(sets.map(s => s.id))); // default: all selected, user can uncheck
    setStep('sets');
  };

  const toggleSet = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(prev =>
      prev.size === availableSets.length ? new Set() : new Set(availableSets.map(s => s.id))
    );
  };

  const handleImport = () => {
    setImporting(true);
    seedSelectedTemplates(Array.from(selectedIds));
    markLevelOnboardingDone();
    onDone();
  };

  const handleSkip = () => {
    markLevelOnboardingDone();
    onDone();
  };

  if (step === 'sets' && chosenLevel) {
    const allSelected = selectedIds.size === availableSets.length;
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>{chosenLevel} sets</h1>
          <p style={styles.subtitle}>Pick which sets to import — you don't have to take them all.</p>

          <div style={styles.selectAllRow}>
            <label style={styles.selectAllLabel}>
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              {allSelected ? 'Deselect all' : 'Select all'}
            </label>
            <span style={styles.selectedCount}>{selectedIds.size} / {availableSets.length} selected</span>
          </div>

          <div style={styles.setList}>
            {availableSets.map(set => (
              <label key={set.id} style={styles.setRow}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(set.id)}
                  onChange={() => toggleSet(set.id)}
                  style={styles.checkbox}
                />
                <span style={styles.setInfo}>
                  <span style={styles.setTitle}>{set.title}</span>
                  <span style={styles.setMeta}>{set.cards.length} cards</span>
                </span>
              </label>
            ))}
          </div>

          <div style={styles.actionsRow}>
            <button style={styles.backButton} onClick={() => setStep('level')} disabled={importing}>
              ← Back
            </button>
            <button
              style={{ ...styles.importButton, opacity: selectedIds.size === 0 || importing ? 0.5 : 1 }}
              onClick={handleImport}
              disabled={selectedIds.size === 0 || importing}
            >
              Import {selectedIds.size || ''} Set{selectedIds.size === 1 ? '' : 's'}
            </button>
          </div>

          <button style={styles.skipButton} onClick={handleSkip} disabled={importing}>
            Skip — I'll create my own
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Welcome to FlashMind</h1>
        <p style={styles.subtitle}>What's your JLPT level? We'll show you matching flashcard sets to choose from.</p>

        <div style={styles.grid}>
          {LEVELS.map(({ level, label, hint, hasContent }) => (
            <button key={level} style={styles.levelButton} onClick={() => handlePickLevel(level)}>
              <span style={styles.levelLabel}>{label}</span>
              <span style={styles.levelHint}>{hint}</span>
              {!hasContent && <span style={styles.comingSoon}>Starter sets coming soon</span>}
            </button>
          ))}
        </div>

        <button style={styles.skipButton} onClick={handleSkip}>
          Not sure — I'll create my own
        </button>
      </div>
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: { position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc', padding: '20px', overflowY: 'auto' },
  card: { backgroundColor: '#fff', borderRadius: '20px', padding: '40px', maxWidth: '480px', width: '100%', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', textAlign: 'center', maxHeight: '85vh', overflowY: 'auto' },
  title: { fontSize: '26px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0' },
  subtitle: { fontSize: '15px', color: '#64748b', margin: '0 0 28px 0', lineHeight: '1.5' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '20px' },
  levelButton: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', padding: '18px 12px', border: '2px solid #e2e8f0', borderRadius: '14px', backgroundColor: '#fff', cursor: 'pointer', transition: 'border-color 0.15s' },
  levelLabel: { fontSize: '22px', fontWeight: 700, color: '#3b82f6' },
  levelHint: { fontSize: '12px', color: '#64748b' },
  comingSoon: { fontSize: '10px', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' },
  skipButton: { background: 'none', border: 'none', color: '#64748b', fontSize: '14px', cursor: 'pointer', textDecoration: 'underline', marginTop: '4px' },
  selectAllRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', fontSize: '14px' },
  selectAllLabel: { display: 'flex', alignItems: 'center', gap: '6px', color: '#334155', cursor: 'pointer', fontWeight: 600 },
  selectedCount: { color: '#64748b' },
  setList: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px', textAlign: 'left', maxHeight: '320px', overflowY: 'auto' },
  setRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer' },
  checkbox: { width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 },
  setInfo: { display: 'flex', flexDirection: 'column', gap: '2px' },
  setTitle: { fontSize: '14px', fontWeight: 600, color: '#0f172a' },
  setMeta: { fontSize: '12px', color: '#64748b' },
  actionsRow: { display: 'flex', gap: '12px', marginBottom: '8px' },
  backButton: { flex: 1, padding: '12px', border: '2px solid #e2e8f0', borderRadius: '10px', backgroundColor: '#fff', color: '#334155', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  importButton: { flex: 2, padding: '12px', border: 'none', borderRadius: '10px', backgroundColor: '#3b82f6', color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer' },
};

export default LevelPicker;

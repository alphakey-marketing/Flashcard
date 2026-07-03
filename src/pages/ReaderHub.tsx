import React, { useState, useEffect, CSSProperties } from 'react';
import { ensurePassagesHydrated, getAllPassages, deletePassage } from '../lib/reader/passageStore';
import { ensureCollectionsHydrated, getAllCollections, createCollection, renameCollection, deleteCollection } from '../lib/reader/collectionStore';
import { ensureVocabHydrated, getVocabMap } from '../lib/reader/vocabStore';
import { recordDailySnapshotIfNeeded } from '../lib/reader/vocabHistory';
import { getReviewEligibleVocab, VOCAB_REVIEW_SET_ID } from '../lib/reader/vocabReview';
import { getDueCards } from '../lib/spacedRepetition';
import type { Passage, Collection } from '../lib/reader/types';
import ImportPassageModal from '../components/ImportPassageModal';

interface ReaderHubProps {
  onNavigateToHome: () => void;
  onOpenPassage: (passageId: string) => void;
  onNavigateToVocabReview: () => void;
}

const ReaderHub: React.FC<ReaderHubProps> = ({ onNavigateToHome, onOpenPassage, onNavigateToVocabReview }) => {
  const [passages, setPassages] = useState<Passage[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingPassage, setEditingPassage] = useState<Passage | undefined>(undefined);
  const [reviewEligibleCount, setReviewEligibleCount] = useState(0);
  const [reviewDueCount, setReviewDueCount] = useState(0);

  useEffect(() => {
    Promise.all([ensurePassagesHydrated(), ensureVocabHydrated(), ensureCollectionsHydrated()]).then(() => {
      setPassages(getAllPassages());
      setCollections(getAllCollections());
      const vocabMap = getVocabMap();
      recordDailySnapshotIfNeeded(vocabMap);
      const eligible = getReviewEligibleVocab(vocabMap);
      setReviewEligibleCount(eligible.length);
      setReviewDueCount(getDueCards(VOCAB_REVIEW_SET_ID).length);
      setLoading(false);
    });
  }, []);

  const handleNewCollection = () => {
    const name = window.prompt('Collection name (e.g. "NHK News", "Textbook Ch. 3"):');
    if (!name?.trim()) return;
    createCollection(name.trim());
    setCollections(getAllCollections());
  };

  const handleRenameCollection = (e: React.MouseEvent, c: Collection) => {
    e.stopPropagation();
    const name = window.prompt('Rename collection:', c.name);
    if (!name?.trim() || name.trim() === c.name) return;
    renameCollection(c.id, name.trim());
    setCollections(getAllCollections());
  };

  const handleDeleteCollection = async (e: React.MouseEvent, c: Collection) => {
    e.stopPropagation();
    if (!window.confirm(`Delete collection "${c.name}"? Passages in it will move back to "All" — they won't be deleted.`)) return;
    await deleteCollection(c.id);
    if (selectedCollectionId === c.id) setSelectedCollectionId(undefined);
    setCollections(getAllCollections());
    setPassages(getAllPassages());
  };

  const handleExportReaderData = () => {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      passages: getAllPassages(),
      collections: getAllCollections(),
      vocabStatus: Array.from(getVocabMap().values()),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `flashmind-reader-backup-${Date.now()}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeletePassage = async (e: React.MouseEvent, p: Passage) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    await deletePassage(p.id);
    setPassages(getAllPassages());
  };

  const handleEditPassage = (e: React.MouseEvent, p: Passage) => {
    e.stopPropagation();
    setEditingPassage(p);
  };

  const visiblePassages = selectedCollectionId
    ? passages.filter(p => p.collectionId === selectedCollectionId)
    : passages;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button style={styles.iconButton} onClick={onNavigateToHome}>←</button>
        <h1 style={styles.title}>📖 Reader</h1>
        <button style={styles.newButton} onClick={() => setShowImportModal(true)}>+ New</button>
      </header>

      <div style={styles.content}>
        {!loading && reviewEligibleCount > 0 && (
          <button style={styles.reviewBanner} onClick={onNavigateToVocabReview}>
            <span style={styles.reviewBannerIcon}>📝</span>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={styles.reviewBannerTitle}>
                {reviewDueCount > 0 ? `${reviewDueCount} word${reviewDueCount === 1 ? '' : 's'} due for review` : 'Review your vocab'}
              </div>
              <div style={styles.reviewBannerSub}>{reviewEligibleCount} words in learning</div>
            </div>
            <span>→</span>
          </button>
        )}

        {!loading && passages.length > 0 && (
          <div style={styles.chipRow}>
            <button
              style={{ ...styles.chip, ...(selectedCollectionId === undefined ? styles.chipActive : {}) }}
              onClick={() => setSelectedCollectionId(undefined)}
            >
              All
            </button>
            {collections.map(c => (
              <div key={c.id} style={styles.chipGroup}>
                <button
                  style={{ ...styles.chip, ...(selectedCollectionId === c.id ? styles.chipActive : {}) }}
                  onClick={() => setSelectedCollectionId(c.id)}
                >
                  {c.name}
                </button>
                <button style={styles.chipIconButton} onClick={e => handleRenameCollection(e, c)} title="Rename collection">✏️</button>
                <button style={styles.chipIconButton} onClick={e => handleDeleteCollection(e, c)} title="Delete collection">🗑️</button>
              </div>
            ))}
            <button style={styles.chipAdd} onClick={handleNewCollection}>+ Collection</button>
          </div>
        )}

        {loading && <p style={styles.emptyText}>Loading passages…</p>}

        {!loading && passages.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>📄</div>
            <h2 style={styles.emptyTitle}>No passages yet</h2>
            <p style={styles.emptyText}>Paste any Japanese text to turn it into a tappable lesson.</p>
            <button style={styles.emptyButton} onClick={() => setShowImportModal(true)}>+ New Passage</button>
          </div>
        )}

        {!loading && passages.length > 0 && visiblePassages.length === 0 && (
          <p style={styles.emptyText}>No passages in this collection yet.</p>
        )}

        {!loading && visiblePassages.length > 0 && (
          <div style={styles.list}>
            {visiblePassages.map(p => (
              <div key={p.id} style={styles.card}>
                <button style={styles.cardMain} onClick={() => onOpenPassage(p.id)}>
                  <div style={styles.cardTitle}>{p.title}</div>
                  <div style={styles.cardMeta}>
                    {p.wordCount} words · {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </button>
                <div style={styles.cardActions}>
                  <button style={styles.cardActionButton} onClick={e => handleEditPassage(e, p)} title="Edit passage">✏️</button>
                  <button style={styles.cardActionButton} onClick={e => handleDeletePassage(e, p)} title="Delete passage">🗑️</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && passages.length > 0 && (
          <button style={styles.exportButton} onClick={handleExportReaderData}>
            💾 Export Reader Data
          </button>
        )}
      </div>

      {showImportModal && (
        <ImportPassageModal
          onClose={() => setShowImportModal(false)}
          onCreated={passage => onOpenPassage(passage.id)}
          collectionId={selectedCollectionId}
        />
      )}

      {editingPassage && (
        <ImportPassageModal
          editingPassage={editingPassage}
          collections={collections}
          onClose={() => setEditingPassage(undefined)}
          onCreated={() => setPassages(getAllPassages())}
        />
      )}
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '16px 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: {
    background: 'none',
    border: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: '#64748b',
    width: '40px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
    flex: 1,
    textAlign: 'center',
  },
  newButton: {
    padding: '8px 16px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#3b82f6',
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  content: {
    maxWidth: '700px',
    margin: '0 auto',
    padding: '24px',
  },
  emptyText: {
    color: '#64748b',
    textAlign: 'center',
  },
  reviewBanner: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#eff6ff',
    border: '2px solid #bfdbfe',
    borderRadius: '12px',
    padding: '14px 16px',
    marginBottom: '16px',
    cursor: 'pointer',
    color: '#1e3a8a',
    fontFamily: 'inherit',
  },
  reviewBannerIcon: {
    fontSize: '24px',
  },
  reviewBannerTitle: {
    fontSize: '14px',
    fontWeight: 700,
  },
  reviewBannerSub: {
    fontSize: '12px',
    color: '#3b82f6',
    marginTop: '2px',
  },
  chipRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  chip: {
    padding: '6px 14px',
    borderRadius: '16px',
    border: '2px solid #e2e8f0',
    backgroundColor: '#fff',
    color: '#64748b',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  chipActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
    color: '#1d4ed8',
  },
  chipGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    border: '2px solid transparent',
    borderRadius: '16px',
  },
  chipIconButton: {
    background: 'none',
    border: 'none',
    fontSize: '11px',
    cursor: 'pointer',
    padding: '2px 4px',
    color: '#94a3b8',
  },
  chipAdd: {
    padding: '6px 14px',
    borderRadius: '16px',
    border: '2px dashed #cbd5e1',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  exportButton: {
    width: '100%',
    marginTop: '20px',
    padding: '12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    backgroundColor: '#fff',
    color: '#475569',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  emptyState: {
    textAlign: 'center',
    padding: '48px 24px',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '8px',
  },
  emptyButton: {
    marginTop: '16px',
    padding: '12px 24px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: '#3b82f6',
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    display: 'flex',
    alignItems: 'stretch',
    backgroundColor: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
  },
  cardMain: {
    flex: 1,
    textAlign: 'left',
    background: 'none',
    border: 'none',
    padding: '16px 20px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  cardActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '0 12px',
  },
  cardActionButton: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: '8px',
    color: '#64748b',
  },
  cardTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '4px',
  },
  cardMeta: {
    fontSize: '13px',
    color: '#94a3b8',
  },
};

export default ReaderHub;

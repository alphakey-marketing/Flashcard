import React, { useState, useEffect, CSSProperties } from 'react';
import { getAllSets, deleteSet, FlashcardSet } from '../lib/storage';
import { exportToCSV } from '../lib/csvParser';
import ImportModal from '../components/ImportModal';

interface HomeProps {
  onNavigateToCreate: () => void;
  onNavigateToSwipe: (setId: string) => void;
}

const Home: React.FC<HomeProps> = ({ onNavigateToCreate, onNavigateToSwipe }) => {
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    loadSets();
  }, []);

  const loadSets = () => {
    setSets(getAllSets());
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this flashcard set?')) {
      deleteSet(id);
      loadSets();
    }
  };

  const handleExport = (e: React.MouseEvent, set: FlashcardSet) => {
    e.stopPropagation();
    
    const csvContent = exportToCSV(set.cards);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${set.title.replace(/[^a-z0-9]/gi, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAll = () => {
    const allData = JSON.stringify(sets, null, 2);
    const blob = new Blob([allData], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `flashmind-backup-${Date.now()}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const calculateProgress = (set: FlashcardSet) => {
    if (set.cards.length === 0) return 0;
    return (set.knownCardIds.length / set.cards.length) * 100;
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>FlashMind</h1>
          <p style={styles.subtitle}>日本語を勉強しよう！</p>
        </div>
        <div style={styles.headerButtons}>
          <button
            style={styles.importButton}
            onClick={() => setShowImportModal(true)}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            📥 Import
          </button>
          <button
            style={styles.addButton}
            onClick={onNavigateToCreate}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            + Create
          </button>
        </div>
      </header>

      {sets.length > 0 && (
        <div style={styles.statsBar}>
          <div style={styles.stat}>
            <span style={styles.statValue}>{sets.length}</span>
            <span style={styles.statLabel}>Sets</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statValue}>
              {sets.reduce((sum, set) => sum + set.cards.length, 0)}
            </span>
            <span style={styles.statLabel}>Total Cards</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statValue}>
              {sets.reduce((sum, set) => sum + set.knownCardIds.length, 0)}
            </span>
            <span style={styles.statLabel}>Mastered</span>
          </div>
          <button
            style={styles.exportAllButton}
            onClick={handleExportAll}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            💾 Backup All
          </button>
        </div>
      )}

      {sets.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📚</div>
          <h2 style={styles.emptyTitle}>No Flashcard Sets Yet</h2>
          <p style={styles.emptyText}>Create your first set or import existing cards to start studying!</p>
          <div style={styles.emptyButtons}>
            <button
              style={styles.createButton}
              onClick={onNavigateToCreate}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              + Create New Set
            </button>
            <button
              style={styles.importButtonLarge}
              onClick={() => setShowImportModal(true)}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              📥 Import CSV
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {sets.map((set) => {
            const progress = calculateProgress(set);
            return (
              <div
                key={set.id}
                style={styles.card}
                onClick={() => onNavigateToSwipe(set.id)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)';
                }}
              >
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>{set.title}</h3>
                  <div style={styles.cardActions}>
                    <button
                      style={styles.exportButton}
                      onClick={(e) => handleExport(e, set)}
                      title="Export to CSV"
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                    >
                      📤
                    </button>
                    <button
                      style={styles.deleteButton}
                      onClick={(e) => handleDelete(e, set.id)}
                      title="Delete set"
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                {set.description && (
                  <p style={styles.cardDescription}>{set.description}</p>
                )}
                
                <div style={styles.cardFooter}>
                  <span style={styles.cardCount}>{set.cards.length} cards</span>
                  <span style={styles.progressText}>
                    {set.knownCardIds.length}/{set.cards.length}
                  </span>
                </div>
                
                <div style={styles.progressBarContainer}>
                  <div
                    style={{
                      ...styles.progressBar,
                      width: `${progress}%`
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => setShowImportModal(false)}
          onImportSuccess={loadSets}
        />
      )}
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    padding: '24px'
  },
  header: {
    maxWidth: '1000px',
    margin: '0 auto 24px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0,
    marginBottom: '4px'
  },
  subtitle: {
    fontSize: '16px',
    color: '#64748b',
    margin: 0
  },
  headerButtons: {
    display: 'flex',
    gap: '12px'
  },
  importButton: {
    backgroundColor: '#fff',
    color: '#3b82f6',
    border: '2px solid #3b82f6',
    borderRadius: '12px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  addButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  statsBar: {
    maxWidth: '1000px',
    margin: '0 auto 32px',
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    gap: '32px',
    alignItems: 'center',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
  },
  stat: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#3b82f6'
  },
  statLabel: {
    fontSize: '12px',
    color: '#64748b',
    fontWeight: 500
  },
  exportAllButton: {
    marginLeft: 'auto',
    padding: '8px 16px',
    backgroundColor: '#f1f5f9',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    color: '#475569',
    transition: 'opacity 0.2s'
  },
  emptyState: {
    maxWidth: '800px',
    margin: '80px auto',
    textAlign: 'center'
  },
  emptyIcon: {
    fontSize: '64px',
    marginBottom: '16px'
  },
  emptyTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '8px'
  },
  emptyText: {
    fontSize: '16px',
    color: '#64748b',
    marginBottom: '24px'
  },
  emptyButtons: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center'
  },
  createButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 32px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  importButtonLarge: {
    backgroundColor: '#fff',
    color: '#3b82f6',
    border: '2px solid #3b82f6',
    borderRadius: '12px',
    padding: '12px 32px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  grid: {
    maxWidth: '1000px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '16px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.3s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    border: '1px solid #e2e8f0'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '8px'
  },
  cardTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
    flex: 1
  },
  cardActions: {
    display: 'flex',
    gap: '8px'
  },
  exportButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
    opacity: 0.6,
    transition: 'opacity 0.2s'
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '16px',
    padding: '4px',
    opacity: 0.6,
    transition: 'opacity 0.2s'
  },
  cardDescription: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '16px',
    lineHeight: '1.5'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  cardCount: {
    fontSize: '14px',
    color: '#64748b',
    fontWeight: 500
  },
  progressText: {
    fontSize: '14px',
    color: '#22c55e',
    fontWeight: 600
  },
  progressBarContainer: {
    width: '100%',
    height: '6px',
    backgroundColor: '#e2e8f0',
    borderRadius: '3px',
    overflow: 'hidden'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#22c55e',
    transition: 'width 0.3s'
  }
};

export default Home;

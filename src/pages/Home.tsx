import React, { useState, useEffect, CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSets, deleteSet, FlashcardSet } from '../lib/storage';

const Home: React.FC = () => {
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const navigate = useNavigate();

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

  const handleCardClick = (id: string) => {
    navigate(`/swipe/${id}`);
  };

  const calculateProgress = (set: FlashcardSet) => {
    if (set.cards.length === 0) return 0;
    return (set.knownCardIds.length / set.cards.length) * 100;
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>FlashMind</h1>
        <button
          style={styles.addButton}
          onClick={() => navigate('/create')}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          + Add
        </button>
      </header>

      {sets.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📚</div>
          <h2 style={styles.emptyTitle}>No Flashcard Sets Yet</h2>
          <p style={styles.emptyText}>Create your first set to start studying!</p>
          <button
            style={styles.createButton}
            onClick={() => navigate('/create')}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Create New Set
          </button>
        </div>
      ) : (
        <div style={styles.grid}>
          {sets.map((set) => {
            const progress = calculateProgress(set);
            return (
              <div
                key={set.id}
                style={styles.card}
                onClick={() => handleCardClick(set.id)}
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
                  <button
                    style={styles.deleteButton}
                    onClick={(e) => handleDelete(e, set.id)}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                  >
                    🗑️
                  </button>
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
    maxWidth: '800px',
    margin: '0 auto 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: '32px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0
  },
  addButton: {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s'
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
  grid: {
    maxWidth: '800px',
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
    fontSize: '20px',
    fontWeight: 600,
    color: '#0f172a',
    margin: 0,
    flex: 1
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
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

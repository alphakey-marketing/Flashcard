import React, { useState, CSSProperties } from 'react';
import { FlashcardSet } from '../lib/storage';

interface BrowseCardsProps {
  set: FlashcardSet;
  onExit: () => void;
}

const BrowseCards: React.FC<BrowseCardsProps> = ({ set, onExit }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getCardParts = (text: string) => {
    if (!text) return { main: '', kana: '', example: '' };
    const lines = text.split('\n');
    const mainLine = lines[0].trim();
    const example = lines.length > 1 ? lines.slice(1).join('\n').trim() : '';
    const bracketMatch = mainLine.match(/^(.*?)\[(.*?)\]/);
    if (bracketMatch) {
      return { main: bracketMatch[1].trim(), kana: bracketMatch[2].trim(), example };
    }
    return { main: mainLine, kana: '', example };
  };

  const normalizeQuery = (q: string) => q.toLowerCase().trim();

  const filteredCards = set.cards.filter(card => {
    if (!searchQuery) return true;
    const q = normalizeQuery(searchQuery);
    return (
      card.front.toLowerCase().includes(q) ||
      card.back.toLowerCase().includes(q) ||
      (card.example && card.example.toLowerCase().includes(q))
    );
  });

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <button style={styles.backButton} onClick={onExit}>← Back</button>
        <div style={styles.headerCenter}>
          <h2 style={styles.headerTitle}>{set.title}</h2>
          <span style={styles.cardCount}>{filteredCards.length} / {set.cards.length} cards</span>
        </div>
        <div style={{ width: 80 }} />
      </header>

      <div style={styles.searchContainer}>
        <span style={styles.searchIcon}>🔍</span>
        <input
          style={styles.searchInput}
          type="text"
          placeholder="Search cards…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        {searchQuery && (
          <button style={styles.clearButton} onClick={() => setSearchQuery('')}>✕</button>
        )}
      </div>

      <div style={styles.cardList}>
        {filteredCards.length === 0 ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🔍</div>
            <p style={styles.emptyText}>No cards match "{searchQuery}"</p>
          </div>
        ) : (
          filteredCards.map((card, idx) => {
            const front = getCardParts(card.front);
            const back = getCardParts(card.back);
            const isExpanded = expandedId === card.id;

            return (
              <div
                key={card.id}
                style={styles.cardRow}
                onClick={() => setExpandedId(isExpanded ? null : card.id)}
              >
                <div style={styles.cardRowIndex}>{idx + 1}</div>
                <div style={styles.cardRowContent}>
                  <div style={styles.cardRowFront}>
                    <span style={styles.frontMain}>{front.main}</span>
                    {front.kana && <span style={styles.frontKana}> [{front.kana}]</span>}
                  </div>
                  <div style={styles.cardRowBack}>{back.main}</div>
                  {isExpanded && (front.example || back.example || card.example) && (
                    <div style={styles.exampleBox}>
                      <span style={styles.exampleLabel}>例文:</span>{' '}
                      {front.example || back.example || card.example}
                    </div>
                  )}
                </div>
                <div style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 10
  },
  backButton: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    color: '#64748b',
    fontWeight: 600,
    padding: '4px 8px',
    width: 80
  },
  headerCenter: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2
  },
  headerTitle: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#0f172a',
    margin: 0
  },
  cardCount: {
    fontSize: '12px',
    color: '#64748b'
  },
  searchContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #e2e8f0',
    position: 'sticky',
    top: 57,
    zIndex: 9
  },
  searchIcon: {
    fontSize: '16px',
    color: '#94a3b8'
  },
  searchInput: {
    flex: 1,
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '14px',
    color: '#0f172a',
    outline: 'none',
    backgroundColor: '#f8fafc'
  },
  clearButton: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px'
  },
  cardList: {
    flex: 1,
    padding: '8px 0'
  },
  cardRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '14px 16px',
    backgroundColor: '#fff',
    borderBottom: '1px solid #f1f5f9',
    cursor: 'pointer',
    transition: 'background-color 0.15s'
  },
  cardRowIndex: {
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: 600,
    minWidth: 24,
    paddingTop: 2
  },
  cardRowContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  cardRowFront: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 4,
    flexWrap: 'wrap'
  },
  frontMain: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#0f172a'
  },
  frontKana: {
    fontSize: '13px',
    color: '#64748b'
  },
  cardRowBack: {
    fontSize: '14px',
    color: '#475569'
  },
  exampleBox: {
    marginTop: 6,
    padding: '8px 10px',
    backgroundColor: '#f0f9ff',
    borderLeft: '3px solid #3b82f6',
    borderRadius: '0 6px 6px 0',
    fontSize: '13px',
    color: '#1e40af',
    lineHeight: 1.5
  },
  exampleLabel: {
    fontWeight: 700,
    color: '#1e40af'
  },
  expandArrow: {
    fontSize: '10px',
    color: '#94a3b8',
    paddingTop: 4
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 20px'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: 16
  },
  emptyText: {
    fontSize: '16px',
    color: '#64748b'
  }
};

export default BrowseCards;

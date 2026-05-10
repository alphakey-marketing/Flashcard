import React, { useState, useEffect, useRef, CSSProperties } from 'react';
import { FlashcardSet } from '../lib/storage';

interface MatchGameProps {
  set: FlashcardSet;
  onExit: () => void;
}

interface Tile {
  id: string;        // unique per tile (cardId + ':front' or ':back')
  cardId: string;
  text: string;
  side: 'front' | 'back';
  matched: boolean;
  shaking: boolean;
  selected: boolean;
}

const PAIRS = 8;
const MIN_CARDS = 6;
const BEST_KEY = (setId: string) => `match-best-${setId}`;

const MatchGame: React.FC<MatchGameProps> = ({ set, onExit }) => {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<string[]>([]); // tile IDs currently selected
  const [matched, setMatched] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cards = set.cards;
  const tooFewCards = cards.length < MIN_CARDS;
  const pairCount = Math.min(PAIRS, cards.length);

  useEffect(() => {
    const saved = localStorage.getItem(BEST_KEY(set.id));
    if (saved) setPersonalBest(Number(saved));
    if (!tooFewCards) initGame();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (running) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [running]);

  useEffect(() => {
    if (matched > 0 && matched >= pairCount) {
      setRunning(false);
      setFinished(true);
      const prev = localStorage.getItem(BEST_KEY(set.id));
      const prevBest = prev ? Number(prev) : null;
      if (prevBest === null || elapsed < prevBest) {
        localStorage.setItem(BEST_KEY(set.id), String(elapsed));
        setPersonalBest(elapsed);
      }
    }
  }, [matched]);

  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const initGame = () => {
    const sample = shuffle(cards).slice(0, pairCount);
    const newTiles: Tile[] = [];
    sample.forEach(card => {
      newTiles.push({ id: card.id + ':front', cardId: card.id, text: card.front, side: 'front', matched: false, shaking: false, selected: false });
      newTiles.push({ id: card.id + ':back', cardId: card.id, text: card.back, side: 'back', matched: false, shaking: false, selected: false });
    });
    setTiles(shuffle(newTiles));
    setSelected([]);
    setMatched(0);
    setElapsed(0);
    setRunning(false);
    setFinished(false);
    setAttempts(0);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleTileClick = (tileId: string) => {
    if (finished) return;
    const tile = tiles.find(t => t.id === tileId);
    if (!tile || tile.matched || tile.selected) return;

    if (!running) setRunning(true);

    const newSelected = [...selected, tileId];
    setTiles(prev => prev.map(t => t.id === tileId ? { ...t, selected: true } : t));

    if (newSelected.length === 2) {
      const [a, b] = newSelected.map(id => tiles.find(t => t.id === id)!);
      setAttempts(n => n + 1);

      if (a.cardId === b.cardId && a.side !== b.side) {
        // Match!
        setTimeout(() => {
          setTiles(prev => prev.map(t =>
            t.id === a.id || t.id === b.id ? { ...t, matched: true, selected: false } : t
          ));
          setMatched(m => m + 1);
          setSelected([]);
        }, 200);
      } else {
        // No match — shake and unselect
        setTimeout(() => {
          setTiles(prev => prev.map(t =>
            t.id === a.id || t.id === b.id ? { ...t, shaking: true } : t
          ));
        }, 200);
        setTimeout(() => {
          setTiles(prev => prev.map(t =>
            t.id === a.id || t.id === b.id ? { ...t, selected: false, shaking: false } : t
          ));
          setSelected([]);
        }, 700);
        return;
      }
      setSelected([]);
    } else {
      setSelected(newSelected);
    }
  };

  if (tooFewCards) {
    return (
      <div style={styles.container}>
        <div style={styles.center}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🃏</div>
          <h2 style={styles.title}>Not enough cards</h2>
          <p style={styles.subtitle}>You need at least {MIN_CARDS} cards to play Match Game.</p>
          <p style={styles.subtitle}>This deck has {cards.length} card{cards.length === 1 ? '' : 's'}.</p>
          <button style={styles.primaryButton} onClick={onExit}>← Back</button>
        </div>
      </div>
    );
  }

  if (finished) {
    const isNewBest = personalBest !== null && elapsed <= personalBest;
    return (
      <div style={styles.container}>
        <div style={styles.center}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>{isNewBest ? '🏆' : '🎉'}</div>
          <h2 style={styles.title}>{isNewBest ? 'New Personal Best!' : 'Matched!'}</h2>
          <div style={styles.resultGrid}>
            <div style={styles.resultItem}>
              <div style={styles.resultValue}>{formatTime(elapsed)}</div>
              <div style={styles.resultLabel}>Time</div>
            </div>
            <div style={styles.resultItem}>
              <div style={styles.resultValue}>{attempts}</div>
              <div style={styles.resultLabel}>Attempts</div>
            </div>
            <div style={styles.resultItem}>
              <div style={styles.resultValue}>{personalBest ? formatTime(personalBest) : '—'}</div>
              <div style={styles.resultLabel}>Best Time</div>
            </div>
          </div>
          <div style={styles.resultButtons}>
            <button style={styles.primaryButton} onClick={initGame}>🔄 Play Again</button>
            <button style={styles.secondaryButton} onClick={onExit}>← Back to Deck</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backButton} onClick={onExit}>✕</button>
        <h2 style={styles.headerTitle}>🎮 Match: {set.title}</h2>
        <div style={styles.headerRight}>
          <span style={styles.timerText}>{formatTime(elapsed)}</span>
          <span style={styles.progressText}>{matched}/{pairCount} matched</span>
        </div>
      </div>

      <div style={styles.grid}>
        {tiles.map(tile => (
          <button
            key={tile.id}
            style={{
              ...styles.tile,
              ...(tile.matched ? styles.tileMatched : {}),
              ...(tile.selected && !tile.matched ? styles.tileSelected : {}),
              ...(tile.shaking ? styles.tileShaking : {}),
              animationName: tile.shaking ? 'shake' : 'none',
            }}
            onClick={() => handleTileClick(tile.id)}
            disabled={tile.matched}
          >
            <span style={styles.tileText}>{tile.text.split('\n')[0]}</span>
            {tile.side === 'front' ? (
              <span style={styles.tileSideLabel}>JP</span>
            ) : (
              <span style={{ ...styles.tileSideLabel, backgroundColor: '#e0f2fe', color: '#0369a1' }}>EN</span>
            )}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-6px); }
          40%, 80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: { minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' },
  header: {
    backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', padding: '12px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px'
  },
  backButton: { background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b', padding: '4px', width: '32px' },
  headerTitle: { fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0, flex: 1, textAlign: 'center' },
  headerRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' },
  timerText: { fontSize: '18px', fontWeight: 700, color: '#3b82f6', fontVariantNumeric: 'tabular-nums' },
  progressText: { fontSize: '12px', color: '#64748b', fontWeight: 500 },
  grid: {
    flex: 1, display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '10px', padding: '16px', maxWidth: '800px', margin: '0 auto', width: '100%'
  },
  tile: {
    position: 'relative', backgroundColor: '#fff', border: '2px solid #e2e8f0',
    borderRadius: '12px', padding: '14px 8px', cursor: 'pointer', minHeight: '80px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '6px', transition: 'all 0.15s ease', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    fontFamily: 'inherit'
  },
  tileSelected: {
    backgroundColor: '#dbeafe', borderColor: '#3b82f6',
    boxShadow: '0 4px 12px rgba(59,130,246,0.25)', transform: 'scale(1.03)'
  },
  tileMatched: {
    backgroundColor: '#d1fae5', borderColor: '#10b981',
    opacity: 0.6, cursor: 'default', transform: 'none'
  },
  tileShaking: { borderColor: '#ef4444', backgroundColor: '#fee2e2' },
  tileText: { fontSize: '15px', fontWeight: 600, color: '#0f172a', textAlign: 'center', lineHeight: '1.3' },
  tileSideLabel: {
    fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '8px',
    backgroundColor: '#fef3c7', color: '#92400e', letterSpacing: '0.5px'
  },
  center: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '40px 24px', textAlign: 'center'
  },
  title: { fontSize: '28px', fontWeight: 700, color: '#0f172a', marginBottom: '12px' },
  subtitle: { fontSize: '16px', color: '#64748b', marginBottom: '8px' },
  resultGrid: { display: 'flex', gap: '40px', justifyContent: 'center', margin: '24px 0', flexWrap: 'wrap' },
  resultItem: { display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' },
  resultValue: { fontSize: '32px', fontWeight: 700, color: '#3b82f6' },
  resultLabel: { fontSize: '13px', color: '#64748b', fontWeight: 500 },
  resultButtons: { display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' },
  primaryButton: {
    backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px',
    padding: '14px 28px', fontSize: '16px', fontWeight: 600, cursor: 'pointer'
  },
  secondaryButton: {
    backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px',
    padding: '14px 28px', fontSize: '16px', fontWeight: 600, cursor: 'pointer'
  }
};

export default MatchGame;

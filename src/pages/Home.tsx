import React, { useState, useEffect, CSSProperties } from 'react';
import { getAllSets, deleteSet, FlashcardSet } from '../lib/storage';
import { exportToCSV } from '../lib/csvParser';
import { getStreak, getTodayStats } from '../lib/studyStats';
import { getSetStudyStats } from '../lib/spacedRepetition';
import { syncService } from '../lib/syncService';
import { supabase } from '../lib/supabaseClient';
import { getTodayPrompt, getPromptStreak } from '../lib/sentenceBuilder';
import ImportModal from '../components/ImportModal';
import LearningTips from '../components/LearningTips';

interface HomeProps {
  onNavigateToCreate: () => void;
  onNavigateToSwipe: (setId: string) => void;
  onNavigateToLearn: (setId: string) => void;
  onNavigateToStats: () => void;
  onNavigateToSentenceBuilder: (setId: string) => void;
  onNavigateToSpeechPractice: (setId: string) => void;
  onNavigateToDailyWriting: (setId: string) => void;
  onLogout: () => void;
}

const Home: React.FC<HomeProps> = ({ 
  onNavigateToCreate, 
  onNavigateToSwipe, 
  onNavigateToLearn, 
  onNavigateToStats,
  onNavigateToSentenceBuilder,
  onNavigateToSpeechPractice,
  onNavigateToDailyWriting,
  onLogout 
}) => {
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showLearningTips, setShowLearningTips] = useState(false);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [streak, setStreak] = useState({ current: 0, longest: 0, lastStudyDate: '' });
  const [todayStats, setTodayStats] = useState({ totalCards: 0, totalDuration: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsyncedDeckIds, setUnsyncedDeckIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadSets();
    loadStats();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUserId(session.user.id);
      await checkUnsyncedDecks(session.user.id);
    }
  };

  const checkUnsyncedDecks = async (currentUserId: string) => {
    try {
      const localDecks = getAllSets();
      const { decks: cloudDecks } = await syncService.pullAll(currentUserId);
      const cloudDeckIds = new Set(cloudDecks.map(d => d.id));
      
      const unsynced = new Set(
        localDecks
          .filter(d => !cloudDeckIds.has(d.id))
          .map(d => d.id)
      );
      
      console.log(`🔍 Check result: ${unsynced.size} unsynced decks out of ${localDecks.length} local decks`);
      setUnsyncedDeckIds(unsynced);
    } catch (err) {
      console.error('Failed to check unsynced decks:', err);
    }
  };

  const loadSets = () => {
    setSets(getAllSets());
  };

  const loadStats = () => {
    setStreak(getStreak());
    const today = getTodayStats();
    setTodayStats({ totalCards: today.totalCards, totalDuration: today.totalDuration });
  };

  const handleManualSync = async () => {
    if (!userId) {
      alert('Please log in to sync your data');
      return;
    }

    setIsSyncing(true);
    console.log('🔄 Manual sync initiated...');
    
    try {
      const localDecks = getAllSets();
      console.log(`📊 Local: ${localDecks.length} decks`);
      
      const { decks: cloudDecks } = await syncService.pullAll(userId);
      console.log(`☁️ Cloud: ${cloudDecks.length} decks`);
      
      const cloudDeckIds = new Set(cloudDecks.map(d => d.id));
      const missingLocalDecks = localDecks.filter(d => !cloudDeckIds.has(d.id));
      
      console.log(`🔍 Found ${missingLocalDecks.length} decks to sync:`, missingLocalDecks.map(d => d.title));
      
      if (missingLocalDecks.length > 0) {
        const results = await Promise.allSettled(
          missingLocalDecks.map(deck => syncService.pushDeck(deck, userId))
        );
        
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected');
        
        console.log(`✅ ${successful} decks synced successfully`);
        
        if (failed.length > 0) {
          console.error(`❌ ${failed.length} decks failed to sync:`, failed);
          alert(`⚠️ Partially synced: ${successful}/${missingLocalDecks.length} decks succeeded.\n\nErrors:\n${failed.map((f: any) => f.reason?.message || 'Unknown error').join('\n')}`);
        } else {
          alert(`✅ Successfully synced ${missingLocalDecks.length} deck(s) to cloud!`);
        }
        
        const syncedDeckIds = new Set(
          missingLocalDecks
            .filter((_, index) => results[index].status === 'fulfilled')
            .map(d => d.id)
        );
        
        setUnsyncedDeckIds(prevUnsynced => {
          const newUnsynced = new Set(prevUnsynced);
          syncedDeckIds.forEach(id => newUnsynced.delete(id));
          console.log(`💾 Updated unsynced state: ${newUnsynced.size} remaining`);
          return newUnsynced;
        });
        
        setTimeout(async () => {
          console.log('🔍 Running verification check...');
          await checkUnsyncedDecks(userId);
        }, 2000);
      } else {
        alert('✅ All decks are already synced!');
      }
    } catch (err: any) {
      console.error('Sync failed:', err);
      alert(`❌ Sync failed: ${err.message || 'Unknown error'}\n\nCheck browser console (F12) for details.`);
      await checkUnsyncedDecks(userId);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this flashcard set?')) {
      deleteSet(id);
      loadSets();
      if (userId) {
        checkUnsyncedDecks(userId);
      }
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

  const toggleCardExpansion = (cardId: string) => {
    setExpandedCardId(expandedCardId === cardId ? null : cardId);
  };

  const hasUnsyncedDecks = unsyncedDeckIds.size > 0;

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>FlashMind</h1>
          <p style={styles.subtitle}>日本語を勉強しよう！</p>
        </div>
        <div style={styles.headerButtons}>
          {userId && (
            <button
              style={{
                ...styles.syncButton,
                backgroundColor: hasUnsyncedDecks ? '#ef4444' : '#10b981',
                cursor: isSyncing ? 'not-allowed' : 'pointer',
                opacity: isSyncing ? 0.6 : 1
              }}
              onClick={handleManualSync}
              disabled={isSyncing}
              title={hasUnsyncedDecks ? `${unsyncedDeckIds.size} deck(s) not synced to cloud` : 'All decks synced'}
              onMouseEnter={(e) => !isSyncing && (e.currentTarget.style.transform = 'scale(1.05)')}
              onMouseLeave={(e) => !isSyncing && (e.currentTarget.style.transform = 'scale(1)')}
            >
              {isSyncing ? '🔄 Syncing...' : hasUnsyncedDecks ? `⚠️ Sync (${unsyncedDeckIds.size})` : '✅ Synced'}
            </button>
          )}
          <button
            style={styles.tipsButton}
            onClick={() => setShowLearningTips(true)}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            title="View Learning Tips"
          >
            🎯 Tips
          </button>
          <button
            style={styles.logoutButton}
            onClick={onLogout}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Log Out
          </button>
          <button
            style={styles.statsButton}
            onClick={onNavigateToStats}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            📊 Stats
          </button>
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

      {/* Streak Banner */}
      {streak.current > 0 && (
        <div style={styles.streakBanner} onClick={onNavigateToStats}>
          <span style={styles.streakIcon}>🔥</span>
          <span style={styles.streakText}>{streak.current} day streak!</span>
          {todayStats.totalCards > 0 && (
            <span style={styles.todayBadge}>{todayStats.totalCards} cards today</span>
          )}
        </div>
      )}

      {/* Unsynced Warning Banner */}
      {hasUnsyncedDecks && userId && (
        <div style={styles.warningBanner}>
          <span style={styles.warningIcon}>⚠️</span>
          <span style={styles.warningText}>
            {unsyncedDeckIds.size} deck(s) not backed up to cloud. Click "Sync" to save them.
          </span>
          <button
            style={styles.syncNowButton}
            onClick={handleManualSync}
            disabled={isSyncing}
          >
            {isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      )}

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
              {sets.reduce((sum, set) => sum + getSetStudyStats(set.id, set.cards.length).masteredCards, 0)}
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
            const stats = getSetStudyStats(set.id, set.cards.length);
            const isUnsynced = unsyncedDeckIds.has(set.id);
            const isExpanded = expandedCardId === set.id;
            const reviewedCards = stats.totalReviews > 0 ? Math.min(set.cards.length, stats.totalReviews) : 0;
            const progress = set.cards.length === 0 ? 0 : (reviewedCards / set.cards.length) * 100;
            const hasDue = stats.dueCards > 0;
            
            // Check if daily writing is available
            const todayPrompt = getTodayPrompt(set.id, set.cards);
            const writingStreak = getPromptStreak(set.id);
            const hasDailyPrompt = todayPrompt !== null;
            const isDailyCompleted = todayPrompt?.completedAt !== undefined;
            
            return (
              <div
                key={set.id}
                style={{
                  ...styles.card,
                  border: isUnsynced ? '2px solid #ef4444' : '1px solid #e2e8f0'
                }}
              >
                <div style={styles.cardHeader}>
                  <h3 style={styles.cardTitle}>
                    {isUnsynced && <span style={styles.unsyncedBadge}>☁️</span>}
                    {set.title}
                  </h3>
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

                {hasDue && (
                  <div style={styles.dueBadge}>
                    🎯 {stats.dueCards} {stats.dueCards === 1 ? 'card' : 'cards'} due
                  </div>
                )}

                {hasDailyPrompt && (
                  <div style={{
                    ...styles.dailyBadge,
                    backgroundColor: isDailyCompleted ? '#d1fae5' : '#fef3c7',
                    color: isDailyCompleted ? '#065f46' : '#92400e'
                  }}>
                    {isDailyCompleted ? '✅ Daily writing complete!' : '✍️ Daily writing available'}
                    {writingStreak > 0 && <span style={styles.dailyStreakIcon}> 🔥{writingStreak}</span>}
                  </div>
                )}
                
                <div style={styles.cardFooter}>
                  <span style={styles.cardCount}>{set.cards.length} cards</span>
                  <span style={styles.progressText}>
                    {reviewedCards}/{set.cards.length} reviewed
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

                {/* Primary Study Buttons */}
                <div style={styles.studyButtons}>
                  <button
                    style={styles.learnButton}
                    onClick={() => onNavigateToLearn(set.id)}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    🎯 Learn Mode
                  </button>
                  <button
                    style={styles.reviewButton}
                    onClick={() => onNavigateToSwipe(set.id)}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    💭 Review
                  </button>
                </div>

                {/* Active Learning Section - Expandable */}
                <div style={styles.activeLearningSection}>
                  <button
                    style={styles.expandButton}
                    onClick={() => toggleCardExpansion(set.id)}
                  >
                    <span style={styles.expandIcon}>🎤</span>
                    <span style={styles.expandText}>Active Practice</span>
                    <span style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {isExpanded && (
                    <div style={styles.activeButtons}>
                      <button
                        style={styles.activeButton}
                        onClick={() => onNavigateToSentenceBuilder(set.id)}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        <div style={styles.activeButtonIcon}>🏗️</div>
                        <div style={styles.activeButtonText}>
                          <div style={styles.activeButtonTitle}>Sentence Builder</div>
                          <div style={styles.activeButtonDesc}>Create sentences</div>
                        </div>
                      </button>

                      <button
                        style={styles.activeButton}
                        onClick={() => onNavigateToSpeechPractice(set.id)}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        <div style={styles.activeButtonIcon}>🎤</div>
                        <div style={styles.activeButtonText}>
                          <div style={styles.activeButtonTitle}>Speech Practice</div>
                          <div style={styles.activeButtonDesc}>Record & compare</div>
                        </div>
                      </button>

                      <button
                        style={styles.activeButton}
                        onClick={() => onNavigateToDailyWriting(set.id)}
                        onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-2px)')}
                        onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                      >
                        <div style={styles.activeButtonIcon}>✍️</div>
                        <div style={styles.activeButtonText}>
                          <div style={styles.activeButtonTitle}>Daily Writing</div>
                          <div style={styles.activeButtonDesc}>
                            {isDailyCompleted ? 'Complete! ✅' : 'Today\'s prompt'}
                            {writingStreak > 0 && ` 🔥${writingStreak}`}
                          </div>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => {
            setShowImportModal(false);
            loadSets();
            if (userId) {
              checkUnsyncedDecks(userId);
            }
          }}
          onImportSuccess={() => {
            loadSets();
            if (userId) {
              checkUnsyncedDecks(userId);
            }
          }}
        />
      )}

      {showLearningTips && (
        <LearningTips onClose={() => setShowLearningTips(false)} />
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
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '12px'
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
    gap: '12px',
    flexWrap: 'wrap'
  },
  syncButton: {
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  tipsButton: {
    backgroundColor: '#fff',
    color: '#f59e0b',
    border: '2px solid #f59e0b',
    borderRadius: '12px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s'
  },
  logoutButton: {
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '12px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  statsButton: {
    backgroundColor: '#fff',
    color: '#8b5cf6',
    border: '2px solid #8b5cf6',
    borderRadius: '12px',
    padding: '12px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s'
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
  streakBanner: {
    maxWidth: '1000px',
    margin: '0 auto 16px',
    backgroundColor: '#fef3c7',
    borderRadius: '12px',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    transition: 'transform 0.2s',
    border: '2px solid #fbbf24'
  },
  streakIcon: {
    fontSize: '24px'
  },
  streakText: {
    fontSize: '16px',
    fontWeight: 600,
    color: '#92400e',
    flex: 1
  },
  todayBadge: {
    backgroundColor: '#fff',
    padding: '4px 12px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
    color: '#16a34a'
  },
  warningBanner: {
    maxWidth: '1000px',
    margin: '0 auto 16px',
    backgroundColor: '#fee2e2',
    borderRadius: '12px',
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    border: '2px solid #ef4444'
  },
  warningIcon: {
    fontSize: '24px'
  },
  warningText: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#7f1d1d',
    flex: 1
  },
  syncNowButton: {
    backgroundColor: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s'
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
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    flexWrap: 'wrap'
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
    justifyContent: 'center',
    flexWrap: 'wrap'
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
    transition: 'all 0.3s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    display: 'flex',
    flexDirection: 'column'
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
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  unsyncedBadge: {
    fontSize: '16px',
    opacity: 0.7
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
    lineHeight: '1.5',
    flex: 1
  },
  dueBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ef4444',
    color: 'white',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '8px'
  },
  dailyBadge: {
    alignSelf: 'flex-start',
    padding: '4px 10px',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px'
  },
  dailyStreakIcon: {
    fontSize: '11px'
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
    overflow: 'hidden',
    marginBottom: '16px'
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#22c55e',
    transition: 'width 0.3s'
  },
  studyButtons: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px'
  },
  learnButton: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  reviewButton: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '14px',
    fontWeight: 600,
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  activeLearningSection: {
    borderTop: '1px solid #e2e8f0',
    paddingTop: '12px'
  },
  expandButton: {
    width: '100%',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '10px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    fontSize: '14px',
    fontWeight: 600,
    color: '#475569'
  },
  expandIcon: {
    fontSize: '16px'
  },
  expandText: {
    flex: 1,
    textAlign: 'left'
  },
  expandArrow: {
    fontSize: '12px',
    color: '#94a3b8'
  },
  activeButtons: {
    marginTop: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  activeButton: {
    backgroundColor: '#fff',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    padding: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    textAlign: 'left'
  },
  activeButtonIcon: {
    fontSize: '24px',
    flexShrink: 0
  },
  activeButtonText: {
    flex: 1
  },
  activeButtonTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#0f172a',
    marginBottom: '2px'
  },
  activeButtonDesc: {
    fontSize: '12px',
    color: '#64748b'
  }
};

export default Home;

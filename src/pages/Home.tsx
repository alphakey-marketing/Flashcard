import React, { useState, useEffect, CSSProperties } from 'react';
import { getAllSets, deleteSet, FlashcardSet, saveSet } from '../lib/storage';
import { exportToCSV } from '../lib/csvParser';
import { getStreak, getTodayStats } from '../lib/studyStats';
import { getSetStudyStats, getSetReviewData } from '../lib/spacedRepetition';
import { CloudSync } from '../lib/sync/cloudSync';
import { SyncManager } from '../lib/sync/syncManager';
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

type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | undefined;

const CATEGORY_COLLAPSE_KEY = 'flashmind-collapsed-categories';

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
  const [editingLevelSetId, setEditingLevelSetId] = useState<string | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState({ current: 0, longest: 0, lastStudyDate: '' });
  const [todayStats, setTodayStats] = useState({ totalCards: 0, totalDuration: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsyncedDeckIds, setUnsyncedDeckIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadSets();
    loadStats();
    checkAuth();
    loadCollapsedCategories();
  }, []);

  const loadCollapsedCategories = () => {
    try {
      const saved = localStorage.getItem(CATEGORY_COLLAPSE_KEY);
      if (saved) setCollapsedCategories(new Set(JSON.parse(saved)));
    } catch (e) {
      console.error('Error loading collapsed categories:', e);
    }
  };

  const saveCollapsedCategories = (collapsed: Set<string>) => {
    try {
      localStorage.setItem(CATEGORY_COLLAPSE_KEY, JSON.stringify(Array.from(collapsed)));
    } catch (e) {
      console.error('Error saving collapsed categories:', e);
    }
  };

  const toggleCategoryCollapse = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      saveCollapsedCategories(next);
      return next;
    });
  };

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUserId(session.user.id);
      await checkUnsyncedDecks();
    }
  };

  /**
   * Compare local deck IDs against cloud deck IDs.
   * Both sides now use raw local IDs, so comparison is a direct string match.
   * A deck is "unsynced" if its ID does not appear in the cloud.
   */
  const checkUnsyncedDecks = async () => {
    try {
      const localDecks = getAllSets();
      const cloudDecks = await CloudSync.pullDecks();
      const cloudIds = new Set(cloudDecks.map(d => d.id));

      const unsynced = new Set(
        localDecks.filter(d => !cloudIds.has(d.id)).map(d => d.id)
      );

      console.log(`🔍 Unsynced: ${unsynced.size} / ${localDecks.length} decks`);
      setUnsyncedDeckIds(unsynced);
    } catch (err) {
      console.error('Failed to check unsynced decks:', err);
    }
  };

  const loadSets = () => setSets(getAllSets());

  const loadStats = () => {
    setStreak(getStreak());
    const today = getTodayStats();
    setTodayStats({ totalCards: today.totalCards, totalDuration: today.totalDuration });
  };

  /**
   * Manual sync: push all unsynced local decks to cloud, then re-check.
   */
  const handleManualSync = async () => {
    if (!userId) {
      alert('Please log in to sync your data');
      return;
    }

    setIsSyncing(true);
    try {
      const localDecks = getAllSets();
      const cloudDecks = await CloudSync.pullDecks();
      const cloudIds = new Set(cloudDecks.map(d => d.id));
      const toSync = localDecks.filter(d => !cloudIds.has(d.id));

      if (toSync.length === 0) {
        alert('✅ All decks are already synced!');
        setUnsyncedDeckIds(new Set());
        return;
      }

      console.log(`📤 Syncing ${toSync.length} deck(s)...`);
      const results = await Promise.allSettled(toSync.map(d => CloudSync.pushDeck(d)));

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

      if (failed.length > 0) {
        alert(`⚠️ Partially synced: ${succeeded}/${toSync.length} succeeded.\n\n${failed.map(f => f.reason?.message).join('\n')}`);
      } else {
        alert(`✅ Successfully synced ${succeeded} deck(s) to cloud!`);
      }
    } catch (err: any) {
      alert(`❌ Sync failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSyncing(false);
      // Always re-check after sync attempt so the banner state is accurate
      await checkUnsyncedDecks();
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this flashcard set?')) {
      deleteSet(id);
      loadSets();
      checkUnsyncedDecks();
    }
  };

  const handleExport = (e: React.MouseEvent, set: FlashcardSet) => {
    e.stopPropagation();
    const csvContent = exportToCSV(set.cards);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `${set.title.replace(/[^a-z0-9]/gi, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportAll = () => {
    const blob = new Blob([JSON.stringify(sets, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `flashmind-backup-${Date.now()}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleCardExpansion = (cardId: string) =>
    setExpandedCardId(expandedCardId === cardId ? null : cardId);

  const handleEditLevel = (e: React.MouseEvent, setId: string) => {
    e.stopPropagation();
    setEditingLevelSetId(setId);
  };

  const handleSaveLevel = (setId: string, newLevel: JLPTLevel) => {
    const set = sets.find(s => s.id === setId);
    if (set) {
      saveSet({ ...set, jlptLevel: newLevel });
      loadSets();
      setEditingLevelSetId(null);
      checkUnsyncedDecks();
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode(prev => !prev);
    if (selectionMode) setSelectedSetIds(new Set());
  };

  const toggleSetSelection = (setId: string) => {
    setSelectedSetIds(prev => {
      const next = new Set(prev);
      next.has(setId) ? next.delete(setId) : next.add(setId);
      return next;
    });
  };

  const handleBulkMove = (targetLevel: JLPTLevel) => {
    if (selectedSetIds.size === 0) { alert('Please select at least one set'); return; }
    selectedSetIds.forEach(id => {
      const set = sets.find(s => s.id === id);
      if (set) saveSet({ ...set, jlptLevel: targetLevel });
    });
    loadSets();
    setSelectedSetIds(new Set());
    setSelectionMode(false);
    checkUnsyncedDecks();
    alert(`✅ Moved ${selectedSetIds.size} set(s) to ${targetLevel || 'Custom'}!`);
  };

  const hasUnsyncedDecks = unsyncedDeckIds.size > 0;

  const totalDueCards = sets.reduce(
    (sum, set) => sum + getSetStudyStats(set.id, set.cards.length).dueCards, 0
  );

  const groupedSets = sets.reduce((acc, set) => {
    const level = set.jlptLevel || 'Custom';
    if (!acc[level]) acc[level] = [];
    acc[level].push(set);
    return acc;
  }, {} as Record<string, FlashcardSet[]>);

  const categories = ['N5', 'N4', 'N3', 'N2', 'N1', 'Custom'].filter(
    cat => groupedSets[cat]?.length > 0
  );

  const renderSetCard = (set: FlashcardSet) => {
    const stats = getSetStudyStats(set.id, set.cards.length);
    const isUnsynced = unsyncedDeckIds.has(set.id);
    const isExpanded = expandedCardId === set.id;
    const isEditingLevel = editingLevelSetId === set.id;
    const isSelected = selectedSetIds.has(set.id);
    const reviewedCards = stats.totalReviews > 0 ? Math.min(set.cards.length, stats.totalReviews) : 0;
    const progress = set.cards.length === 0 ? 0 : (reviewedCards / set.cards.length) * 100;
    const hasDue = stats.dueCards > 0;

    let todayPrompt = null;
    let writingStreak = 0;
    let hasDailyPrompt = false;
    let isDailyCompleted = false;

    try {
      const reviewData = getSetReviewData(set.id);
      const masteredIds = new Set(
        reviewData.filter(r => r.status === 'mastered').map(r => r.cardId)
      );
      const masteredCards = set.cards.filter(c => masteredIds.has(c.id));
      if (masteredCards.length >= 3) {
        todayPrompt = getTodayPrompt(set.id, masteredCards);
        writingStreak = getPromptStreak(set.id);
        hasDailyPrompt = todayPrompt !== null;
        isDailyCompleted = todayPrompt?.completedAt !== undefined;
      }
    } catch (e) {
      console.error('Error checking daily prompt:', e);
    }

    return (
      <div
        key={set.id}
        style={{
          ...styles.card,
          border: isSelected ? '3px solid #3b82f6' : isUnsynced ? '2px solid #ef4444' : '1px solid #e2e8f0',
          backgroundColor: isSelected ? '#eff6ff' : '#fff'
        }}
        onClick={() => selectionMode && toggleSetSelection(set.id)}
      >
        {selectionMode && (
          <div style={styles.selectionCheckbox}>
            <input type="checkbox" checked={isSelected} onChange={() => toggleSetSelection(set.id)} style={styles.checkbox} />
          </div>
        )}

        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>
            {isUnsynced && <span style={styles.unsyncedBadge}>☁️</span>}
            {set.title}
          </h3>
          {!selectionMode && (
            <div style={styles.cardActions}>
              <button style={styles.editLevelButton} onClick={e => handleEditLevel(e, set.id)} title="Change JLPT Level">📝</button>
              <button style={styles.exportButton} onClick={e => handleExport(e, set)} title="Export to CSV">📤</button>
              <button style={styles.deleteButton} onClick={e => handleDelete(e, set.id)} title="Delete set">🗑️</button>
            </div>
          )}
        </div>

        {isEditingLevel && !selectionMode && (
          <div style={styles.levelEditor}>
            <select
              value={set.jlptLevel || ''}
              onChange={e => handleSaveLevel(set.id, (e.target.value as JLPTLevel) || undefined)}
              style={styles.levelSelect}
              autoFocus
            >
              <option value="">Custom / No Level</option>
              <option value="N5">N5 (Beginner)</option>
              <option value="N4">N4 (Elementary)</option>
              <option value="N3">N3 (Intermediate)</option>
              <option value="N2">N2 (Upper-Intermediate)</option>
              <option value="N1">N1 (Advanced)</option>
            </select>
            <button style={styles.cancelLevelButton} onClick={() => setEditingLevelSetId(null)}>Cancel</button>
          </div>
        )}

        {!selectionMode && (
          <>
            {set.description && <p style={styles.cardDescription}>{set.description}</p>}

            {hasDue && (
              <div style={styles.dueBadge}>🎯 {stats.dueCards} {stats.dueCards === 1 ? 'card' : 'cards'} due</div>
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
              <span style={styles.progressText}>{reviewedCards}/{set.cards.length} reviewed</span>
            </div>

            <div style={styles.progressBarContainer}>
              <div style={{ ...styles.progressBar, width: `${progress}%` }} />
            </div>

            <div style={styles.studyButtons}>
              <button style={styles.learnButton} onClick={() => onNavigateToLearn(set.id)}>🎯 Learn Mode</button>
              <button style={styles.reviewButton} onClick={() => onNavigateToSwipe(set.id)}>💬 Review</button>
            </div>

            <div style={styles.activeLearningSection}>
              <button style={styles.expandButton} onClick={() => toggleCardExpansion(set.id)}>
                <span style={styles.expandIcon}>🎤</span>
                <span style={styles.expandText}>Active Practice</span>
                <span style={styles.expandArrow}>{isExpanded ? '▲' : '▼'}</span>
              </button>

              {isExpanded && (
                <div style={styles.activeButtons}>
                  <button style={styles.activeButton} onClick={() => onNavigateToSentenceBuilder(set.id)}>
                    <div style={styles.activeButtonIcon}>🏗️</div>
                    <div style={styles.activeButtonText}>
                      <div style={styles.activeButtonTitle}>Sentence Builder</div>
                      <div style={styles.activeButtonDesc}>Create sentences</div>
                    </div>
                  </button>
                  <button style={styles.activeButton} onClick={() => onNavigateToSpeechPractice(set.id)}>
                    <div style={styles.activeButtonIcon}>🎤</div>
                    <div style={styles.activeButtonText}>
                      <div style={styles.activeButtonTitle}>Speech Practice</div>
                      <div style={styles.activeButtonDesc}>Record & compare</div>
                    </div>
                  </button>
                  <button style={styles.activeButton} onClick={() => onNavigateToDailyWriting(set.id)}>
                    <div style={styles.activeButtonIcon}>✍️</div>
                    <div style={styles.activeButtonText}>
                      <div style={styles.activeButtonTitle}>Daily Writing</div>
                      <div style={styles.activeButtonDesc}>
                        {isDailyCompleted ? 'Complete! ✅' : "Today's prompt"}
                        {writingStreak > 0 && ` 🔥${writingStreak}`}
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>FlashMind</h1>
          <p style={styles.subtitle}>日本語を勉強しよう!</p>
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
              title={hasUnsyncedDecks ? `${unsyncedDeckIds.size} deck(s) not synced` : 'All decks synced'}
            >
              {isSyncing ? '🔄 Syncing...' : hasUnsyncedDecks ? `⚠️ Sync (${unsyncedDeckIds.size})` : '✅ Synced'}
            </button>
          )}
          <button style={styles.tipsButton} onClick={() => setShowLearningTips(true)}>🎯 Tips</button>
          <button style={styles.logoutButton} onClick={onLogout}>Log Out</button>
          <button style={styles.statsButton} onClick={onNavigateToStats}>📊 Stats</button>
          <button style={styles.importButton} onClick={() => setShowImportModal(true)}>📥 Import</button>
          <button style={styles.addButton} onClick={onNavigateToCreate}>+ Create</button>
        </div>
      </header>

      {streak.current > 0 && (
        <div style={styles.streakBanner} onClick={onNavigateToStats}>
          <span style={styles.streakIcon}>🔥</span>
          <span style={styles.streakText}>{streak.current} day streak!</span>
          {todayStats.totalCards > 0 && (
            <span style={styles.todayBadge}>{todayStats.totalCards} cards today</span>
          )}
        </div>
      )}

      {totalDueCards > 0 && (
        <div style={styles.dueTodayBanner}>
          <div style={styles.dueTodayInfo}>
            <span style={styles.dueTodayIcon}>⏰</span>
            <div>
              <h3 style={styles.dueTodayTitle}>{totalDueCards} Cards Due Today</h3>
              <p style={styles.dueTodayDesc}>Review cards across all your sets to maintain your progress.</p>
            </div>
          </div>
          <button style={styles.dueTodayButton} onClick={() => onNavigateToSwipe('due-today')}>Review All Due Now</button>
        </div>
      )}

      {selectionMode && (
        <div style={styles.selectionToolbar}>
          <div style={styles.selectionInfo}>
            <span style={styles.selectionIcon}>✓</span>
            <span style={styles.selectionText}>{selectedSetIds.size} set(s) selected</span>
          </div>
          <div style={styles.selectionActions}>
            <span style={styles.moveLabel}>Move to:</span>
            {(['N5','N4','N3','N2','N1'] as JLPTLevel[]).map(lvl => (
              <button key={lvl} style={styles.moveButton} onClick={() => handleBulkMove(lvl)}>{lvl}</button>
            ))}
            <button style={styles.moveButton} onClick={() => handleBulkMove(undefined)}>Custom</button>
            <button style={styles.cancelSelectionButton} onClick={toggleSelectionMode}>Cancel</button>
          </div>
        </div>
      )}

      {hasUnsyncedDecks && userId && (
        <div style={styles.warningBanner}>
          <span style={styles.warningIcon}>⚠️</span>
          <span style={styles.warningText}>
            {unsyncedDeckIds.size} deck(s) not backed up to cloud. Click "Sync" to save them.
          </span>
          <button style={styles.syncNowButton} onClick={handleManualSync} disabled={isSyncing}>
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
            <span style={styles.statValue}>{sets.reduce((s, set) => s + set.cards.length, 0)}</span>
            <span style={styles.statLabel}>Total Cards</span>
          </div>
          <div style={styles.stat}>
            <span style={styles.statValue}>
              {sets.reduce((s, set) => s + getSetStudyStats(set.id, set.cards.length).masteredCards, 0)}
            </span>
            <span style={styles.statLabel}>Mastered</span>
          </div>
          <button style={styles.bulkSelectButton} onClick={toggleSelectionMode}>
            {selectionMode ? '❌ Cancel' : '☑️ Select Multiple'}
          </button>
          <button style={styles.exportAllButton} onClick={handleExportAll}>💾 Backup All</button>
        </div>
      )}

      {sets.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>📚</div>
          <h2 style={styles.emptyTitle}>No Flashcard Sets Yet</h2>
          <p style={styles.emptyText}>Create your first set or import existing cards to start studying!</p>
          <div style={styles.emptyButtons}>
            <button style={styles.createButton} onClick={onNavigateToCreate}>+ Create New Set</button>
            <button style={styles.importButtonLarge} onClick={() => setShowImportModal(true)}>📥 Import CSV</button>
          </div>
        </div>
      ) : (
        <div style={styles.categoriesContainer}>
          {categories.map(category => {
            const isCollapsed = collapsedCategories.has(category);
            const catStats = groupedSets[category].reduce(
              (acc, set) => {
                const s = getSetStudyStats(set.id, set.cards.length);
                return { totalCards: acc.totalCards + set.cards.length, dueCards: acc.dueCards + s.dueCards, masteredCards: acc.masteredCards + s.masteredCards };
              },
              { totalCards: 0, dueCards: 0, masteredCards: 0 }
            );

            return (
              <div key={category} style={styles.categorySection}>
                <div style={styles.categoryHeaderContainer} onClick={() => !selectionMode && toggleCategoryCollapse(category)}>
                  <h2 style={styles.categoryHeader}>
                    {!selectionMode && <span style={styles.categoryToggle}>{isCollapsed ? '▶' : '▼'}</span>}
                    <span>{category === 'Custom' ? 'My Custom Sets' : `${category} Level Sets`}</span>
                    <span style={styles.categoryBadge}>{groupedSets[category].length}</span>
                  </h2>
                  {isCollapsed && !selectionMode && (
                    <div style={styles.categoryPreview}>
                      <span style={styles.previewStat}>{catStats.totalCards} cards</span>
                      {catStats.dueCards > 0 && <span style={styles.previewDue}>🎯 {catStats.dueCards} due</span>}
                      <span style={styles.previewStat}>✅ {catStats.masteredCards} mastered</span>
                    </div>
                  )}
                </div>

                {(!isCollapsed || selectionMode) && (
                  <div style={styles.grid}>
                    {groupedSets[category].map(set => renderSetCard(set))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => { setShowImportModal(false); loadSets(); checkUnsyncedDecks(); }}
          onImportSuccess={() => { loadSets(); checkUnsyncedDecks(); }}
        />
      )}

      {showLearningTips && <LearningTips onClose={() => setShowLearningTips(false)} />}
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: { minHeight: '100vh', backgroundColor: '#f8fafc', padding: '24px' },
  header: { maxWidth: '1000px', margin: '0 auto 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
  title: { fontSize: '32px', fontWeight: 700, color: '#0f172a', margin: 0, marginBottom: '4px' },
  subtitle: { fontSize: '16px', color: '#64748b', margin: 0 },
  headerButtons: { display: 'flex', gap: '12px', flexWrap: 'wrap' },
  syncButton: { color: 'white', border: 'none', borderRadius: '12px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  tipsButton: { backgroundColor: '#fff', color: '#f59e0b', border: '2px solid #f59e0b', borderRadius: '12px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  logoutButton: { backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  statsButton: { backgroundColor: '#fff', color: '#8b5cf6', border: '2px solid #8b5cf6', borderRadius: '12px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  importButton: { backgroundColor: '#fff', color: '#3b82f6', border: '2px solid #3b82f6', borderRadius: '12px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  addButton: { backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  streakBanner: { maxWidth: '1000px', margin: '0 auto 16px', backgroundColor: '#fef3c7', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', border: '2px solid #fbbf24' },
  streakIcon: { fontSize: '24px' },
  streakText: { fontSize: '16px', fontWeight: 600, color: '#92400e', flex: 1 },
  todayBadge: { backgroundColor: '#fff', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: '#16a34a' },
  dueTodayBanner: { maxWidth: '1000px', margin: '0 auto 16px', backgroundColor: '#eff6ff', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', border: '2px solid #bfdbfe', flexWrap: 'wrap' },
  dueTodayInfo: { display: 'flex', alignItems: 'center', gap: '16px' },
  dueTodayIcon: { fontSize: '32px' },
  dueTodayTitle: { margin: '0 0 4px 0', color: '#1e3a8a', fontSize: '18px', fontWeight: 700 },
  dueTodayDesc: { margin: 0, color: '#3b82f6', fontSize: '14px' },
  dueTodayButton: { backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  selectionToolbar: { maxWidth: '1000px', margin: '0 auto 16px', backgroundColor: '#3b82f6', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  selectionInfo: { display: 'flex', alignItems: 'center', gap: '12px' },
  selectionIcon: { fontSize: '24px', color: 'white' },
  selectionText: { fontSize: '16px', fontWeight: 600, color: 'white' },
  selectionActions: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  moveLabel: { fontSize: '14px', fontWeight: 600, color: 'white', marginRight: '4px' },
  moveButton: { backgroundColor: 'white', color: '#3b82f6', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  cancelSelectionButton: { backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginLeft: '8px' },
  warningBanner: { maxWidth: '1000px', margin: '0 auto 16px', backgroundColor: '#fee2e2', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', border: '2px solid #ef4444' },
  warningIcon: { fontSize: '24px' },
  warningText: { fontSize: '14px', fontWeight: 600, color: '#7f1d1d', flex: 1 },
  syncNowButton: { backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  statsBar: { maxWidth: '1000px', margin: '0 auto 32px', backgroundColor: '#fff', borderRadius: '12px', padding: '20px', display: 'flex', gap: '32px', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', flexWrap: 'wrap' },
  stat: { display: 'flex', flexDirection: 'column', gap: '4px' },
  statValue: { fontSize: '24px', fontWeight: 700, color: '#3b82f6' },
  statLabel: { fontSize: '12px', color: '#64748b', fontWeight: 500 },
  bulkSelectButton: { marginLeft: 'auto', padding: '8px 16px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  exportAllButton: { padding: '8px 16px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: '#475569' },
  emptyState: { maxWidth: '800px', margin: '80px auto', textAlign: 'center' },
  emptyIcon: { fontSize: '64px', marginBottom: '16px' },
  emptyTitle: { fontSize: '24px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' },
  emptyText: { fontSize: '16px', color: '#64748b', marginBottom: '24px' },
  emptyButtons: { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' },
  createButton: { backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 32px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' },
  importButtonLarge: { backgroundColor: '#fff', color: '#3b82f6', border: '2px solid #3b82f6', borderRadius: '12px', padding: '12px 32px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' },
  categoriesContainer: { maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' },
  categorySection: { display: 'flex', flexDirection: 'column', gap: '16px' },
  categoryHeaderContainer: { cursor: 'pointer', userSelect: 'none', backgroundColor: '#fff', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '2px solid #e2e8f0' },
  categoryHeader: { margin: 0, fontSize: '20px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '12px' },
  categoryToggle: { fontSize: '16px', color: '#64748b', width: '20px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  categoryBadge: { backgroundColor: '#e2e8f0', color: '#475569', fontSize: '14px', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 },
  categoryPreview: { marginTop: '12px', display: 'flex', gap: '16px', alignItems: 'center', fontSize: '13px', color: '#64748b', flexWrap: 'wrap' },
  previewStat: { fontWeight: 500 },
  previewDue: { backgroundColor: '#fef2f2', color: '#dc2626', padding: '4px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' },
  card: { backgroundColor: '#fff', borderRadius: '16px', padding: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', position: 'relative', cursor: 'default' },
  selectionCheckbox: { position: 'absolute', top: '12px', left: '12px', zIndex: 5 },
  checkbox: { width: '20px', height: '20px', cursor: 'pointer' },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' },
  cardTitle: { fontSize: '18px', fontWeight: 600, color: '#0f172a', margin: 0, flex: 1, display: 'flex', alignItems: 'center', gap: '8px' },
  unsyncedBadge: { fontSize: '16px', opacity: 0.7 },
  cardActions: { display: 'flex', gap: '8px' },
  editLevelButton: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px', opacity: 0.6 },
  exportButton: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px', opacity: 0.6 },
  deleteButton: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px', opacity: 0.6 },
  levelEditor: { display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' },
  levelSelect: { flex: 1, padding: '8px 12px', fontSize: '14px', border: '2px solid #3b82f6', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' },
  cancelLevelButton: { padding: '8px 12px', fontSize: '14px', backgroundColor: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#475569', fontWeight: 600 },
  cardDescription: { fontSize: '14px', color: '#64748b', marginBottom: '16px', lineHeight: '1.5', flex: 1 },
  dueBadge: { alignSelf: 'flex-start', backgroundColor: '#ef4444', color: 'white', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, marginBottom: '8px' },
  dailyBadge: { alignSelf: 'flex-start', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' },
  dailyStreakIcon: { fontSize: '11px' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  cardCount: { fontSize: '14px', color: '#64748b', fontWeight: 500 },
  progressText: { fontSize: '14px', color: '#22c55e', fontWeight: 600 },
  progressBarContainer: { width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '16px' },
  progressBar: { height: '100%', backgroundColor: '#22c55e', transition: 'width 0.3s' },
  studyButtons: { display: 'flex', gap: '8px', marginBottom: '12px' },
  learnButton: { flex: 1, padding: '12px 16px', fontSize: '14px', fontWeight: 600, backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  reviewButton: { flex: 1, padding: '12px 16px', fontSize: '14px', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer' },
  activeLearningSection: { borderTop: '1px solid #e2e8f0', paddingTop: '12px' },
  expandButton: { width: '100%', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: '#475569' },
  expandIcon: { fontSize: '16px' },
  expandText: { flex: 1, textAlign: 'left' },
  expandArrow: { fontSize: '12px', color: '#94a3b8' },
  activeButtons: { marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' },
  activeButton: { backgroundColor: '#fff', border: '2px solid #e2e8f0', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', textAlign: 'left' },
  activeButtonIcon: { fontSize: '24px', flexShrink: 0 },
  activeButtonText: { flex: 1 },
  activeButtonTitle: { fontSize: '14px', fontWeight: 600, color: '#0f172a', marginBottom: '2px' },
  activeButtonDesc: { fontSize: '12px', color: '#64748b' }
};

export default Home;

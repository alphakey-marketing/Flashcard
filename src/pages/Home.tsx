import React, { useState, useEffect, CSSProperties } from 'react';
import { getAllSets, FlashcardSet, saveSet } from '../lib/storage';
import { exportToCSV } from '../lib/csvParser';
import { getStreak, getTodayStats } from '../lib/studyStats';
import { getSetStudyStats, getSetReviewData, pickStudyMode } from '../lib/spacedRepetition';
import { CloudSync } from '../lib/sync/cloudSync';
import { SyncManager } from '../lib/sync/syncManager';
import { supabase } from '../lib/supabaseClient';
import { getTodayPrompt, getPromptStreak } from '../lib/sentenceBuilder';
import { VOCAB_REVIEW_SET_ID } from '../lib/reader/vocabReview';
import ImportModal from '../components/ImportModal';
import LearningTips from '../components/LearningTips';
import OverflowMenu from '../components/OverflowMenu';
import LevelPicker from './LevelPicker';

interface HomeProps {
  onNavigateToCreate: () => void;
  onNavigateToEditSet: (setId: string) => void;
  onNavigateToSwipe: (setId: string) => void;
  onNavigateToLearn: (setId: string) => void;
  onNavigateToMatch: (setId: string) => void;
  onNavigateToStats: () => void;
  onNavigateToSentenceBuilder: (setId: string) => void;
  onNavigateToSpeechPractice: (setId: string) => void;
  onNavigateToDailyWriting: (setId: string) => void;
  onNavigateToBrowseCards: (setId: string) => void;
  onNavigateToReaderHub: () => void;
  onLogout: () => void;
}

type JLPTLevel = 'N5' | 'N4' | 'N3' | 'N2' | 'N1' | undefined;

const CATEGORY_COLLAPSE_KEY = 'flashmind-collapsed-categories';

const Home: React.FC<HomeProps> = ({
  onNavigateToCreate,
  onNavigateToEditSet,
  onNavigateToSwipe,
  onNavigateToLearn,
  onNavigateToMatch,
  onNavigateToStats,
  onNavigateToSentenceBuilder,
  onNavigateToSpeechPractice,
  onNavigateToDailyWriting,
  onNavigateToBrowseCards,
  onNavigateToReaderHub,
  onLogout
}) => {
  const [sets, setSets] = useState<FlashcardSet[]>([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [showLearningTips, setShowLearningTips] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const [streak, setStreak] = useState({ current: 0, longest: 0, lastStudyDate: '' });
  const [todayStats, setTodayStats] = useState({ totalCards: 0, totalDuration: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [unsyncedDeckIds, setUnsyncedDeckIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [sourceFilter, setSourceFilter] = useState('');

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

  const loadSets = () => {
    // The auto-managed Reader Vocabulary deck is hidden once it has no cards
    // left (e.g. everything in it has graduated to Known) rather than deleted
    // — it comes right back the next time a word enters Learning.
    const all = getAllSets();
    setSets(all.filter(s => !(s.id === VOCAB_REVIEW_SET_ID && s.cards.length === 0)));
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
      await checkUnsyncedDecks();
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this flashcard set?')) {
      try {
        await SyncManager.deleteDeck(id);
      } catch (err) {
        console.error('❌ Failed to delete deck:', err);
        alert('Failed to delete deck. Please try again.');
        return;
      }
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

  const handleEditSet = (e: React.MouseEvent, setId: string) => {
    e.stopPropagation();
    onNavigateToEditSet(setId);
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

  const filteredSets = sourceFilter.trim()
    ? sets.filter(set =>
        set.cards.some(c => c.source?.toLowerCase().includes(sourceFilter.toLowerCase()))
      )
    : sets;

  const groupedSets = filteredSets.reduce((acc, set) => {
    const level = set.jlptLevel || 'Custom';
    if (!acc[level]) acc[level] = [];
    acc[level].push(set);
    return acc;
  }, {} as Record<string, FlashcardSet[]>);

  const categories = ['N5', 'N4', 'N3', 'N2', 'N1', 'Custom'].filter(
    cat => groupedSets[cat]?.length > 0
  );

  const renderSetCard = (set: FlashcardSet) => {
    const isReaderDeck = set.id === VOCAB_REVIEW_SET_ID;
    const stats = getSetStudyStats(set.id, set.cards.length);
    const studyMode = pickStudyMode(stats);
    const isUnsynced = unsyncedDeckIds.has(set.id);
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
        onClick={() => selectionMode && !isReaderDeck && toggleSetSelection(set.id)}
      >
        {selectionMode && !isReaderDeck && (
          <div style={styles.selectionCheckbox}>
            <input type="checkbox" checked={isSelected} onChange={() => toggleSetSelection(set.id)} style={styles.checkbox} />
          </div>
        )}

        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>
            {isUnsynced && <span style={styles.unsyncedBadge}>☁️</span>}
            {set.title}
            {isReaderDeck && <span style={styles.autoManagedBadge}>🤖 Auto</span>}
          </h3>
          {!selectionMode && (
            <div style={styles.cardActions}>
              {!isReaderDeck && (
                <button style={styles.editLevelButton} onClick={e => handleEditSet(e, set.id)} title="Edit set">📝</button>
              )}
              <button style={styles.exportButton} onClick={e => handleExport(e, set)} title="Export to CSV">📤</button>
              {!isReaderDeck && (
                <button style={styles.deleteButton} onClick={e => handleDelete(e, set.id)} title="Delete set">🗑️</button>
              )}
            </div>
          )}
        </div>

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

            <div style={styles.studyRow}>
              <button
                style={{ ...styles.studyButton, ...(studyMode === null ? styles.studyButtonDisabled : {}) }}
                disabled={studyMode === null}
                onClick={() => studyMode === 'learn' ? onNavigateToLearn(set.id) : studyMode === 'review' ? onNavigateToSwipe(set.id) : undefined}
              >
                {studyMode === 'learn' ? '🎯 Study' : studyMode === 'review' ? '💬 Study' : '✓ All caught up'}
              </button>
              <OverflowMenu
                triggerAriaLabel={`More actions for ${set.title}`}
                items={[
                  { key: 'browse', icon: '📖', label: 'Browse', onSelect: () => onNavigateToBrowseCards(set.id) },
                  { key: 'match', icon: '🎮', label: 'Match', onSelect: () => onNavigateToMatch(set.id) },
                  { key: 'sentence', icon: '🏗️', label: 'Sentence Builder', description: 'Create sentences', onSelect: () => onNavigateToSentenceBuilder(set.id) },
                  { key: 'speech', icon: '🎤', label: 'Speech Practice', description: 'Record & compare', onSelect: () => onNavigateToSpeechPractice(set.id) },
                  {
                    key: 'daily',
                    icon: '✍️',
                    label: 'Daily Writing',
                    description: (isDailyCompleted ? 'Complete! ✅' : "Today's prompt") + (writingStreak > 0 ? ` 🔥${writingStreak}` : ''),
                    onSelect: () => onNavigateToDailyWriting(set.id),
                  },
                ]}
              />
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
          <button style={styles.readerButton} onClick={onNavigateToReaderHub}>📖 Reader</button>
          <button style={styles.addButton} onClick={onNavigateToCreate}>+ Create</button>
          <OverflowMenu
            triggerAriaLabel="More options"
            items={[
              ...(userId ? [{
                key: 'sync',
                icon: isSyncing ? '🔄' : hasUnsyncedDecks ? '⚠️' : '✅',
                label: isSyncing ? 'Syncing...' : hasUnsyncedDecks ? `Sync (${unsyncedDeckIds.size})` : 'Synced',
                description: hasUnsyncedDecks ? `${unsyncedDeckIds.size} deck(s) not synced` : 'All decks synced',
                onSelect: handleManualSync,
                disabled: isSyncing,
              }] : []),
              { key: 'tips', icon: '🎯', label: 'Tips', onSelect: () => setShowLearningTips(true) },
              { key: 'stats', icon: '📊', label: 'Stats', onSelect: onNavigateToStats },
              { key: 'import', icon: '📥', label: 'Import', onSelect: () => setShowImportModal(true) },
              { key: 'add-level', icon: '🎓', label: 'Add Level Sets', description: 'Get starter sets for another JLPT level', onSelect: () => setShowLevelPicker(true) },
              { key: 'logout', icon: '🚪', label: 'Log Out', onSelect: onLogout },
            ]}
          />
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

      <div style={styles.startReviewBanner}>
        <div style={styles.startReviewInfo}>
          <span style={styles.startReviewIcon}>📖</span>
          <div>
            <h3 style={styles.startReviewTitle}>
              {totalDueCards > 0
                ? `${totalDueCards} cards ready to review`
                : "You're all caught up!"}
            </h3>
            <p style={styles.startReviewSub}>
              {todayStats.totalCards > 0
                ? `${todayStats.totalCards} card${todayStats.totalCards === 1 ? '' : 's'} reviewed today`
                : totalDueCards > 0
                ? 'Start your daily review session'
                : 'No cards due right now — great work!'}
            </p>
          </div>
        </div>
        {totalDueCards > 0 && (
          <button
            style={styles.startReviewButton}
            onClick={() => onNavigateToSwipe('due-today')}
          >
            ▶ Start Today's Review
          </button>
        )}
      </div>

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
        <>
          <div style={styles.sourceFilterContainer}>
            <input
              type="text"
              placeholder="🔍 Filter by source (e.g. Podcast, textbook...)"
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              style={styles.sourceFilterInput}
            />
            {sourceFilter && (
              <button style={styles.sourceFilterClear} onClick={() => setSourceFilter('')}>✕</button>
            )}
          </div>
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
        </>
      )}

      {showImportModal && (
        <ImportModal
          onClose={() => { setShowImportModal(false); loadSets(); checkUnsyncedDecks(); }}
          onImportSuccess={() => { loadSets(); checkUnsyncedDecks(); }}
        />
      )}

      {showLearningTips && <LearningTips onClose={() => setShowLearningTips(false)} />}

      {showLevelPicker && (
        <LevelPicker onDone={() => { setShowLevelPicker(false); loadSets(); checkUnsyncedDecks(); }} />
      )}
    </div>
  );
};

const styles: { [key: string]: CSSProperties } = {
  container: { minHeight: '100vh', backgroundColor: '#f8fafc', padding: '24px' },
  header: { maxWidth: '1000px', margin: '0 auto 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' },
  title: { fontSize: '32px', fontWeight: 700, color: '#0f172a', margin: 0, marginBottom: '4px' },
  subtitle: { fontSize: '16px', color: '#64748b', margin: 0 },
  headerButtons: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' },
  readerButton: { backgroundColor: '#fff', color: '#8b5cf6', border: '2px solid #8b5cf6', borderRadius: '12px', padding: '12px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  addButton: { backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '12px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  streakBanner: { maxWidth: '1000px', margin: '0 auto 16px', backgroundColor: '#fef3c7', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', border: '2px solid #fbbf24' },
  streakIcon: { fontSize: '24px' },
  streakText: { fontSize: '16px', fontWeight: 600, color: '#92400e', flex: 1 },
  todayBadge: { backgroundColor: '#fff', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, color: '#16a34a' },
  startReviewBanner: { maxWidth: '1000px', margin: '0 auto 16px', backgroundColor: '#f0fdf4', borderRadius: '16px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', border: '2px solid #86efac', flexWrap: 'wrap' },
  startReviewInfo: { display: 'flex', alignItems: 'center', gap: '16px' },
  startReviewIcon: { fontSize: '36px' },
  startReviewTitle: { margin: '0 0 4px 0', color: '#14532d', fontSize: '18px', fontWeight: 700 },
  startReviewSub: { margin: 0, color: '#16a34a', fontSize: '14px' },
  startReviewButton: { backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '12px', padding: '14px 28px', fontSize: '16px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const },
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
  sourceFilterContainer: { maxWidth: '1000px', margin: '0 auto 16px', display: 'flex', alignItems: 'center', gap: '8px' },
  sourceFilterInput: { flex: 1, padding: '10px 14px', fontSize: '14px', border: '2px solid #e2e8f0', borderRadius: '10px', outline: 'none', color: '#0f172a' },
  sourceFilterClear: { background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#94a3b8', padding: '4px' },
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
  autoManagedBadge: { fontSize: '11px', fontWeight: 700, color: '#7c3aed', backgroundColor: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: '10px', padding: '2px 8px', whiteSpace: 'nowrap' as const },
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
  studyRow: { display: 'flex', gap: '8px', alignItems: 'center' },
  studyButton: { flex: 1, padding: '12px 16px', fontSize: '14px', fontWeight: 700, backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' },
  studyButtonDisabled: { backgroundColor: '#f1f5f9', color: '#94a3b8', cursor: 'default' }
};

export default Home;

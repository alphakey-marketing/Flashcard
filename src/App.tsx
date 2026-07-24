import React, { useState, useEffect, useRef } from 'react';
import Home from './pages/Home';
import Create from './pages/Create';
import EditSet from './pages/EditSet';
import Swipe from './pages/Swipe';
import Stats from './pages/Stats';
import Auth from './pages/Auth';
import LearnMode from './pages/LearnMode';
import MatchGame from './pages/MatchGame';
import SentenceBuilder from './pages/SentenceBuilder';
import SpeechPractice from './pages/SpeechPractice';
import DailyWriting from './pages/DailyWriting';
import BrowseCards from './pages/BrowseCards';
import ReaderHub from './pages/ReaderHub';
import Reader from './pages/Reader';
import VocabReview from './pages/VocabReview';
import LevelPicker from './pages/LevelPicker';
import ErrorBoundary from './components/ErrorBoundary';
import QuickCapture from './components/QuickCapture';
import { supabase } from './lib/supabaseClient';
import { SyncManager, type SyncProgress } from './lib/sync/syncManager';
import { getSet, getAllSets, setStorageAuthState, hasCompletedLevelOnboarding } from './lib/storage';
import { setReviewUserId } from './lib/spacedRepetition';

type Page = 'home' | 'create' | 'edit-set' | 'swipe' | 'stats' | 'learn' | 'match-game' | 'sentence-builder' | 'speech-practice' | 'daily-writing' | 'browse-cards' | 'reader-hub' | 'reader' | 'vocab-review';

type NavParams = { setId?: string; passageId?: string };
type HistoryFrame = { page: Page; params: NavParams };

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('Initializing...');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [stack, setStack] = useState<HistoryFrame[]>([{ page: 'home', params: {} }]);
  const current = stack[stack.length - 1];
  // Increments after every completed sync — forces Home to re-mount and re-read fresh localStorage
  const [syncGeneration, setSyncGeneration] = useState(0);

  // Tracks the user ID we last synced for — prevents re-syncing on TOKEN_REFRESHED events
  const lastSyncedUserIdRef = useRef<string | null>(null);
  const setIsSyncingRef = useRef(setIsSyncing);
  const setSyncStatusRef = useRef(setSyncStatus);
  const setSyncErrorRef = useRef(setSyncError);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  useEffect(() => {
    setIsSyncingRef.current = setIsSyncing;
    setSyncStatusRef.current = setSyncStatus;
    setSyncErrorRef.current = setSyncError;
  });

  useEffect(() => {
    SyncManager.setProgressCallback((progress: SyncProgress) => {
      if (progress.phase === 'error') {
        setSyncErrorRef.current(progress.message);
        setIsSyncingRef.current(false);
      } else if (progress.phase === 'complete') {
        setSyncStatusRef.current(progress.message);
        setTimeout(() => setIsSyncingRef.current(false), 1000);
      } else {
        setSyncStatusRef.current(progress.message);
      }
    });
  }, []);

  useEffect(() => {
    const authClient = supabase.auth as any;

    authClient.getSession().then(({ data }: any) => {
      handleSessionChange(data?.session ?? null);
      setIsLoadingSession(false);
    });

    const { data: listenerData } = authClient.onAuthStateChange(
      (event: string, newSession: any) => {
        // TOKEN_REFRESHED fires every ~60s — only update session state, never re-sync
        if (event === 'TOKEN_REFRESHED') {
          setSession(newSession ?? null);
          return;
        }
        handleSessionChange(newSession ?? null);
      }
    );

    return () => listenerData?.subscription?.unsubscribe();
  }, []);

  const handleSessionChange = async (newSession: any) => {
    setSession(newSession);
    setSyncError(null);
    setReviewUserId(newSession?.user?.id ?? null);

    if (newSession?.user) {
      // Block initializeTemplates() from injecting template decks before
      // SyncManager has written cloud data to localStorage
      setStorageAuthState(true);

      const userId = newSession.user.id;

      // Only sync once per unique user login — skip duplicate auth state events
      if (lastSyncedUserIdRef.current === userId) {
        console.log('⏭️ [APP] Skipping sync — already synced for this user');
        return;
      }
      lastSyncedUserIdRef.current = userId;

      console.log('\n' + '='.repeat(60));
      console.log('👤 User logged in:', newSession.user.email);
      console.log('🆔 User ID:', userId);
      console.log('='.repeat(60) + '\n');

      setIsSyncing(true);
      setSyncStatus('Starting sync...');

      try {
        const result = await SyncManager.performSync();
        if (!result.success && result.error) {
          setSyncError(result.error);
        }
        // A brand-new account syncs down zero decks (cloud is empty, nothing
        // local pre-login) — that's the moment to offer the level picker,
        // rather than dropping the user on an empty Home with no path in.
        if (result.success && getAllSets().length === 0 && !hasCompletedLevelOnboarding()) {
          setShowLevelPicker(true);
        }
        // Bump generation BEFORE clearing spinner — Home re-mounts with fresh data
        setSyncGeneration(g => g + 1);
        setIsSyncing(false);
      } catch (err: any) {
        console.error('❌ Unexpected sync error:', err);
        setSyncError(err.message || 'Unknown sync error');
        setIsSyncing(false);
      }
    } else {
      // User logged out — reset auth state and sync guard
      setStorageAuthState(false);
      lastSyncedUserIdRef.current = null;
    }
  };

  const handleLogout = async () => {
    const authClient = supabase.auth as any;
    await authClient.signOut();
  };

  const navigateTo = (page: Page, params: NavParams = {}) => {
    setStack(prev => [...prev, { page, params }]);
    window.history.pushState({ depth: stackRef.current.length + 1 }, '', '');
  };

  // Stack pops happen exclusively here, in response to an actual history
  // transition — whether that transition was caused by our own back()
  // calling history.back() below, or by a hardware/gesture back. This is
  // the single source of truth so one back-action only ever pops one frame.
  const popStack = () => {
    setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : [{ page: 'home', params: {} }]));
  };

  const back = () => {
    window.history.back();
  };

  // Push one baseline history entry so the very first back-gesture/hardware
  // back button has something to pop against instead of exiting the app.
  useEffect(() => {
    window.history.pushState({ depth: 0 }, '', '');
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', popStack);
    return () => window.removeEventListener('popstate', popStack);
  }, []);

  const navigateToHome = () => navigateTo('home', {});
  const navigateToCreate = () => navigateTo('create', {});
  const navigateToEditSet = (setId: string) => navigateTo('edit-set', { setId });
  const navigateToStats = () => navigateTo('stats', {});
  const navigateToSwipe = (setId: string) => navigateTo('swipe', { setId });
  const navigateToLearn = (setId: string) => navigateTo('learn', { setId });
  const navigateToMatch = (setId: string) => navigateTo('match-game', { setId });
  const navigateToSentenceBuilder = (setId: string) => navigateTo('sentence-builder', { setId });
  const navigateToSpeechPractice = (setId: string) => navigateTo('speech-practice', { setId });
  const navigateToDailyWriting = (setId: string) => navigateTo('daily-writing', { setId });
  const navigateToBrowseCards = (setId: string) => navigateTo('browse-cards', { setId });
  const navigateToReaderHub = () => navigateTo('reader-hub', {});
  const navigateToReader = (passageId: string) => navigateTo('reader', { passageId });
  const navigateToVocabReview = () => navigateTo('vocab-review', {});

  // "Session finished successfully" (LearnMode's onComplete) is semantically
  // distinct from "user backed out" (onExit) even though both currently pop
  // the stack the same way — kept separate so a future "suggest next set"
  // step can hook in here without touching onExit's abandon semantics.
  const handleSessionComplete = () => back();

  // Chains straight into the next due set's session, replacing (not pushing
  // onto) the just-finished session's frame — so back() from the new set
  // lands on Home, not on the previous set's already-finished screen. Stack
  // depth is unchanged, so it stays in sync with the real browser history
  // entries without an extra pushState/back() call.
  const handleNavigateToSet = (setId: string, mode: 'learn' | 'review') => {
    setStack(prev => [...prev.slice(0, -1), { page: mode === 'learn' ? 'learn' : 'swipe', params: { setId } }]);
  };

  if (isLoadingSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f8fafc' }}>
        <p style={{ fontSize: '18px', color: '#64748b' }}>Loading FlashMind...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth onLogin={() => {}} />;
  }

  if (isSyncing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f8fafc', padding: '20px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '4px solid #e2e8f0',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '24px'
        }} />
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
        <p style={{ fontSize: '20px', color: '#1e293b', fontWeight: 600, marginBottom: '8px' }}>Syncing Your Data</p>
        <p style={{ fontSize: '14px', color: '#64748b', textAlign: 'center', maxWidth: '400px' }}>{syncStatus}</p>
      </div>
    );
  }

  if (showLevelPicker) {
    return (
      <LevelPicker
        onDone={() => {
          setShowLevelPicker(false);
          setSyncGeneration(g => g + 1);
        }}
      />
    );
  }

  const syncErrorModal = syncError ? (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '500px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '16px', textAlign: 'center', color: '#1e293b' }}>Sync Error</h2>
        <p style={{
          fontSize: '14px',
          color: '#64748b',
          backgroundColor: '#f8fafc',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '24px',
          fontFamily: 'monospace',
          whiteSpace: 'pre-wrap'
        }}>{syncError}</p>
        <button
          onClick={() => setSyncError(null)}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
        >
          Close
        </button>
      </div>
    </div>
  ) : null;

  return (
    <ErrorBoundary>
      <div>
        {syncErrorModal}
        <QuickCapture />
        {current.page === 'home' && (
          <Home
            key={syncGeneration}
            onNavigateToCreate={navigateToCreate}
            onNavigateToEditSet={navigateToEditSet}
            onNavigateToSwipe={navigateToSwipe}
            onNavigateToLearn={navigateToLearn}
            onNavigateToMatch={navigateToMatch}
            onNavigateToStats={navigateToStats}
            onNavigateToSentenceBuilder={navigateToSentenceBuilder}
            onNavigateToSpeechPractice={navigateToSpeechPractice}
            onNavigateToDailyWriting={navigateToDailyWriting}
            onNavigateToBrowseCards={navigateToBrowseCards}
            onNavigateToReaderHub={navigateToReaderHub}
            onLogout={handleLogout}
          />
        )}
        {current.page === 'create' && (
          <Create onNavigateToHome={back} />
        )}
        {current.page === 'edit-set' && current.params.setId && (
          <EditSet setId={current.params.setId} onNavigateToHome={back} />
        )}
        {current.page === 'swipe' && current.params.setId && (
          <Swipe key={current.params.setId} setId={current.params.setId} onNavigateToHome={back} onNavigateToSet={handleNavigateToSet} />
        )}
        {current.page === 'learn' && current.params.setId && getSet(current.params.setId) && (
          <LearnMode
            key={current.params.setId}
            set={getSet(current.params.setId)!}
            onComplete={handleSessionComplete}
            onExit={back}
            onNavigateToSet={handleNavigateToSet}
          />
        )}
        {current.page === 'match-game' && current.params.setId && getSet(current.params.setId) && (
          <MatchGame
            set={getSet(current.params.setId)!}
            onExit={back}
          />
        )}
        {current.page === 'sentence-builder' && current.params.setId && (
          <SentenceBuilder
            set={getSet(current.params.setId)!}
            onExit={back}
          />
        )}
        {current.page === 'speech-practice' && current.params.setId && (
          <SpeechPractice
            set={getSet(current.params.setId)!}
            onExit={back}
          />
        )}
        {current.page === 'daily-writing' && current.params.setId && (
          <DailyWriting
            set={getSet(current.params.setId)!}
            onExit={back}
          />
        )}
        {current.page === 'stats' && (
          <Stats onNavigateToHome={back} />
        )}
        {current.page === 'browse-cards' && current.params.setId && (
          <BrowseCards set={getSet(current.params.setId)!} onExit={back} />
        )}
        {current.page === 'reader-hub' && (
          <ReaderHub
            onNavigateToHome={back}
            onOpenPassage={navigateToReader}
            onNavigateToVocabReview={navigateToVocabReview}
          />
        )}
        {current.page === 'reader' && current.params.passageId && (
          <Reader passageId={current.params.passageId} onExit={back} />
        )}
        {current.page === 'vocab-review' && (
          <VocabReview onExit={back} />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
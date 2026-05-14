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
import ErrorBoundary from './components/ErrorBoundary';
import QuickCapture from './components/QuickCapture';
import { supabase } from './lib/supabaseClient';
import { SyncManager, type SyncProgress } from './lib/sync/syncManager';
import { getSet, setStorageAuthState } from './lib/storage';
import { setReviewUserId } from './lib/spacedRepetition';

type Page = 'home' | 'create' | 'edit-set' | 'swipe' | 'stats' | 'learn' | 'match-game' | 'sentence-builder' | 'speech-practice' | 'daily-writing';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('Initializing...');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  // Increments after every completed sync — forces Home to re-mount and re-read fresh localStorage
  const [syncGeneration, setSyncGeneration] = useState(0);

  // Tracks the user ID we last synced for — prevents re-syncing on TOKEN_REFRESHED events
  const lastSyncedUserIdRef = useRef<string | null>(null);
  const setIsSyncingRef = useRef(setIsSyncing);
  const setSyncStatusRef = useRef(setSyncStatus);
  const setSyncErrorRef = useRef(setSyncError);

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

  const navigateToHome = () => setCurrentPage('home');
  const navigateToCreate = () => setCurrentPage('create');
  const navigateToEditSet = (setId: string) => { setSelectedSetId(setId); setCurrentPage('edit-set'); };
  const navigateToStats = () => setCurrentPage('stats');
  const navigateToSwipe = (setId: string) => { setSelectedSetId(setId); setCurrentPage('swipe'); };
  const navigateToLearn = (setId: string) => { setSelectedSetId(setId); setCurrentPage('learn'); };
  const navigateToMatch = (setId: string) => { setSelectedSetId(setId); setCurrentPage('match-game'); };
  const navigateToSentenceBuilder = (setId: string) => { setSelectedSetId(setId); setCurrentPage('sentence-builder'); };
  const navigateToSpeechPractice = (setId: string) => { setSelectedSetId(setId); setCurrentPage('speech-practice'); };
  const navigateToDailyWriting = (setId: string) => { setSelectedSetId(setId); setCurrentPage('daily-writing'); };

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
        {currentPage === 'home' && (
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
            onLogout={handleLogout}
          />
        )}
        {currentPage === 'create' && (
          <Create onNavigateToHome={navigateToHome} />
        )}
        {currentPage === 'edit-set' && selectedSetId && (
          <EditSet setId={selectedSetId} onNavigateToHome={navigateToHome} />
        )}
        {currentPage === 'swipe' && selectedSetId && (
          <Swipe setId={selectedSetId} onNavigateToHome={navigateToHome} />
        )}
        {currentPage === 'learn' && selectedSetId && getSet(selectedSetId) && (
          <LearnMode
            set={getSet(selectedSetId)!}
            onComplete={navigateToHome}
            onExit={navigateToHome}
          />
        )}
        {currentPage === 'match-game' && selectedSetId && getSet(selectedSetId) && (
          <MatchGame
            set={getSet(selectedSetId)!}
            onExit={navigateToHome}
          />
        )}
        {currentPage === 'sentence-builder' && selectedSetId && (
          <SentenceBuilder
            set={getSet(selectedSetId)!}
            onExit={navigateToHome}
          />
        )}
        {currentPage === 'speech-practice' && selectedSetId && (
          <SpeechPractice
            set={getSet(selectedSetId)!}
            onExit={navigateToHome}
          />
        )}
        {currentPage === 'daily-writing' && selectedSetId && (
          <DailyWriting
            set={getSet(selectedSetId)!}
            onExit={navigateToHome}
          />
        )}
        {currentPage === 'stats' && (
          <Stats onNavigateToHome={navigateToHome} />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;
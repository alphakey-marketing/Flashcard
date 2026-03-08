import React, { useState, useEffect } from 'react';
import Home from './pages/Home';
import Create from './pages/Create';
import Swipe from './pages/Swipe';
import Stats from './pages/Stats';
import Auth from './pages/Auth';
import LearnMode from './pages/LearnMode';
import SentenceBuilder from './pages/SentenceBuilder';
import SpeechPractice from './pages/SpeechPractice';
import DailyWriting from './pages/DailyWriting';
import ErrorBoundary from './components/ErrorBoundary';
import { supabase } from './lib/supabaseClient';
import { syncService } from './lib/syncService';
import { setUserId, getAllSets, overrideStorageWithCloud, getSet } from './lib/storage';
import { setReviewUserId, overrideReviewsWithCloud } from './lib/spacedRepetition';

type Page = 'home' | 'create' | 'swipe' | 'stats' | 'learn' | 'sentence-builder' | 'speech-practice' | 'daily-writing';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSessionChange(session);
      setIsLoadingSession(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleSessionChange(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSessionChange = async (newSession: any) => {
    setSession(newSession);
    setSyncError(null);
    
    if (newSession?.user) {
      const userId = newSession.user.id;
      
      // IMPORTANT: Set user ID FIRST before any operations
      setUserId(userId);
      setReviewUserId(userId);
      
      setIsSyncing(true);
      
      try {
        console.log('🔄 Starting sync for user:', userId);
        
        // Pull latest from cloud
        const { decks: cloudDecks, reviews: cloudReviews } = await syncService.pullAll(userId);
        console.log(`✅ Pulled ${cloudDecks.length} decks from cloud`);
        
        // Get local decks to prevent data loss
        const localDecks = getAllSets();
        console.log(`📱 Found ${localDecks.length} local decks`);
        
        const cloudDeckIds = new Set(cloudDecks.map(d => d.id));
        
        // Find local decks that are NOT in the cloud yet
        const missingLocalDecks = localDecks.filter(d => !cloudDeckIds.has(d.id));
        
        let finalDecks = [...cloudDecks];
        let syncErrors: string[] = [];
        
        if (missingLocalDecks.length > 0) {
          console.log(`📤 Found ${missingLocalDecks.length} local decks not in cloud. Syncing...`);
          
          // Add them locally immediately so they show up
          finalDecks = [...finalDecks, ...missingLocalDecks];
          
          // Push them to the cloud with proper error handling
          const syncPromises = missingLocalDecks.map(async (deck) => {
            try {
              await syncService.pushDeck(deck, userId);
              console.log(`✅ Synced deck: ${deck.title}`);
            } catch (err: any) {
              console.error(`❌ Failed to sync deck "${deck.title}":`, err);
              syncErrors.push(deck.title);
              throw err; // Re-throw to be caught by Promise.allSettled
            }
          });
          
          // Use allSettled to continue even if some fail
          const results = await Promise.allSettled(syncPromises);
          
          const failedCount = results.filter(r => r.status === 'rejected').length;
          const succeededCount = results.filter(r => r.status === 'fulfilled').length;
          
          console.log(`Sync complete: ${succeededCount} succeeded, ${failedCount} failed`);
          
          if (failedCount > 0) {
            setSyncError(`Partially synced: ${failedCount}/${missingLocalDecks.length} decks failed.\n\nErrors:\n${syncErrors.map(title => `Failed to sync deck: ${title}`).join('\n')}`);
          }
        }
        
        // Update local storage with the merged decks
        if (finalDecks.length > 0) {
          overrideStorageWithCloud(finalDecks);
          overrideReviewsWithCloud(cloudReviews);
          console.log('✅ Local storage updated with merged data');
        }
        
      } catch (err: any) {
        console.error('❌ Sync failed:', err);
        setSyncError(`Sync failed: ${err.message || 'Unknown error'}`);
      } finally {
        setIsSyncing(false);
      }
    } else {
      setUserId(null);
      setReviewUserId(null);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navigateToHome = () => setCurrentPage('home');
  const navigateToCreate = () => setCurrentPage('create');
  const navigateToStats = () => setCurrentPage('stats');
  const navigateToSwipe = (setId: string) => {
    setSelectedSetId(setId);
    setCurrentPage('swipe');
  };
  const navigateToLearn = (setId: string) => {
    setSelectedSetId(setId);
    setCurrentPage('learn');
  };
  const navigateToSentenceBuilder = (setId: string) => {
    setSelectedSetId(setId);
    setCurrentPage('sentence-builder');
  };
  const navigateToSpeechPractice = (setId: string) => {
    setSelectedSetId(setId);
    setCurrentPage('speech-practice');
  };
  const navigateToDailyWriting = (setId: string) => {
    setSelectedSetId(setId);
    setCurrentPage('daily-writing');
  };

  if (isLoadingSession) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f8fafc' }}>
        <p style={{ fontSize: '18px', color: '#64748b' }}>Loading...</p>
      </div>
    );
  }

  if (!session) {
    return <Auth onLogin={() => {}} />;
  }

  if (isSyncing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f8fafc', padding: '20px' }}>
        <p style={{ fontSize: '24px', marginBottom: '16px' }}>🔄</p>
        <p style={{ fontSize: '18px', color: '#64748b', fontWeight: 500 }}>Syncing your progress...</p>
        <p style={{ fontSize: '14px', color: '#94a3b8', marginTop: '8px' }}>This may take a moment</p>
      </div>
    );
  }

  // Show sync error modal if there was an error
  const syncErrorModal = syncError ? (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
        padding: '24px',
        maxWidth: '500px',
        maxHeight: '80vh',
        overflow: 'auto',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <div style={{ fontSize: '40px', textAlign: 'center', marginBottom: '16px' }}>⚠️</div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '12px', textAlign: 'center' }}>Sync Error</h2>
        <pre style={{ 
          fontSize: '14px', 
          color: '#475569',
          backgroundColor: '#f1f5f9',
          padding: '12px',
          borderRadius: '8px',
          whiteSpace: 'pre-wrap',
          wordWrap: 'break-word',
          marginBottom: '16px'
        }}>{syncError}</pre>
        <button
          onClick={() => setSyncError(null)}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
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
        {currentPage === 'home' && (
          <Home
            onNavigateToCreate={navigateToCreate}
            onNavigateToSwipe={navigateToSwipe}
            onNavigateToLearn={navigateToLearn}
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
        {currentPage === 'swipe' && selectedSetId && (
          <Swipe setId={selectedSetId} onNavigateToHome={navigateToHome} />
        )}
        {currentPage === 'learn' && selectedSetId && (
          <LearnMode
            set={getSet(selectedSetId)!}
            onComplete={navigateToHome}
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

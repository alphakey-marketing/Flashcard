import React, { useState, useEffect } from 'react';
import Home from './pages/Home';
import Create from './pages/Create';
import Swipe from './pages/Swipe';
import Stats from './pages/Stats';
import Auth from './pages/Auth';
import ErrorBoundary from './components/ErrorBoundary';
import { supabase } from './lib/supabaseClient';
import { syncService } from './lib/syncService';
import { setUserId, getAllSets, overrideStorageWithCloud } from './lib/storage';
import { setReviewUserId, overrideReviewsWithCloud } from './lib/spacedRepetition';

type Page = 'home' | 'create' | 'swipe' | 'stats';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
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
    if (newSession?.user) {
      const userId = newSession.user.id;
      setUserId(userId);
      setReviewUserId(userId);
      
      setIsSyncing(true);
      try {
        // Pull latest from cloud
        const { decks, reviews } = await syncService.pullAll(userId);
        
        if (decks.length > 0) {
          // Cloud has data -> Override local
          overrideStorageWithCloud(decks);
          overrideReviewsWithCloud(reviews);
        } else {
          // Cloud is empty (new account) -> Push local data (like templates) to cloud
          const localSets = getAllSets();
          for (const set of localSets) {
            await syncService.pushDeck(set, userId);
          }
        }
      } catch (err) {
        console.error("Sync failed", err);
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
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#f8fafc' }}>
        <p style={{ fontSize: '24px', marginBottom: '16px' }}>🔄</p>
        <p style={{ fontSize: '18px', color: '#64748b', fontWeight: 500 }}>Syncing your progress...</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div>
        {currentPage === 'home' && (
          <Home
            onNavigateToCreate={navigateToCreate}
            onNavigateToSwipe={navigateToSwipe}
            onNavigateToStats={navigateToStats}
            onLogout={handleLogout}
          />
        )}
        {currentPage === 'create' && (
          <Create onNavigateToHome={navigateToHome} />
        )}
        {currentPage === 'swipe' && selectedSetId && (
          <Swipe setId={selectedSetId} onNavigateToHome={navigateToHome} />
        )}
        {currentPage === 'stats' && (
          <Stats onNavigateToHome={navigateToHome} />
        )}
      </div>
    </ErrorBoundary>
  );
};

export default App;

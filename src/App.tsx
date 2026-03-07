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
        const { decks: cloudDecks, reviews: cloudReviews } = await syncService.pullAll(userId);
        
        // Get local decks to prevent data loss
        const localDecks = getAllSets();
        const cloudDeckIds = new Set(cloudDecks.map(d => d.id));
        
        // Find local decks that are NOT in the cloud yet
        const missingLocalDecks = localDecks.filter(d => !cloudDeckIds.has(d.id));
        
        let finalDecks = [...cloudDecks];
        
        if (missingLocalDecks.length > 0) {
          console.log(`Found ${missingLocalDecks.length} local decks not in cloud. Merging...`);
          // Add them locally immediately so they show up
          finalDecks = [...finalDecks, ...missingLocalDecks];
          
          // Push them to the cloud IN THE BACKGROUND to not block the UI
          Promise.all(missingLocalDecks.map(deck => syncService.pushDeck(deck, userId)))
            .then(() => console.log('Background sync of missing decks complete'))
            .catch(err => console.error('Background sync failed', err));
        }
        
        // Update local storage with the merged decks
        if (finalDecks.length > 0) {
          overrideStorageWithCloud(finalDecks);
          overrideReviewsWithCloud(cloudReviews);
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

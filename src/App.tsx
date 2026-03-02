import React, { useState } from 'react';
import Home from './pages/Home';
import Create from './pages/Create';
import Swipe from './pages/Swipe';
import Stats from './pages/Stats';
import ErrorBoundary from './components/ErrorBoundary';

type Page = 'home' | 'create' | 'swipe' | 'stats';

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const navigateToHome = () => setCurrentPage('home');
  const navigateToCreate = () => setCurrentPage('create');
  const navigateToStats = () => setCurrentPage('stats');
  const navigateToSwipe = (setId: string) => {
    setSelectedSetId(setId);
    setCurrentPage('swipe');
  };

  return (
    <ErrorBoundary>
      <div>
        {currentPage === 'home' && (
          <Home
            onNavigateToCreate={navigateToCreate}
            onNavigateToSwipe={navigateToSwipe}
            onNavigateToStats={navigateToStats}
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

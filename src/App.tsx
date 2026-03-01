import React, { useState } from 'react';
import Home from './pages/Home';
import Create from './pages/Create';
import Swipe from './pages/Swipe';

type Page = 'home' | 'create' | 'swipe';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);

  const navigateToHome = () => {
    setCurrentPage('home');
    setSelectedSetId(null);
  };

  const navigateToCreate = () => {
    setCurrentPage('create');
  };

  const navigateToSwipe = (setId: string) => {
    setSelectedSetId(setId);
    setCurrentPage('swipe');
  };

  return (
    <>
      {currentPage === 'home' && (
        <Home 
          onNavigateToCreate={navigateToCreate}
          onNavigateToSwipe={navigateToSwipe}
        />
      )}
      {currentPage === 'create' && (
        <Create onNavigateToHome={navigateToHome} />
      )}
      {currentPage === 'swipe' && selectedSetId && (
        <Swipe 
          setId={selectedSetId}
          onNavigateToHome={navigateToHome}
        />
      )}
    </>
  );
}

export default App;

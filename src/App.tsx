/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import BottomNav from './components/BottomNav';
import HomeScreen from './screens/HomeScreen';
import NewsScreen from './screens/NewsScreen';
import AniPlayScreen from './screens/AniPlayScreen';
import AniBaseScreen from './screens/AniBaseScreen';
import AnimeDetailsScreen from './screens/AnimeDetailsScreen';
import SettingsScreen from './screens/SettingsScreen';
import AdminUploadScreen from './screens/AdminUploadScreen';
import { AnimatePresence, motion } from 'motion/react';
import { getTrendingAnime, getRecentAnime, getPopularAnime, getAnimeNews } from './services/animeService';

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    // High-priority pre-fetch for instant availability
    const prefetch = async () => {
      try {
        // Run in parallel to warm up the cache
        await Promise.allSettled([
          getTrendingAnime(),
          getRecentAnime(),
          getPopularAnime(),
          getAnimeNews('trending'),
          getAnimeNews('latest'),
          getAnimeNews('hot')
        ]);
        
        // Secondary pre-fetch for other tabs
        const results = await getPopularAnime();
        if (results && results.length > 5) {
          // Pre-fetch details for the first few top items
          await Promise.allSettled(results.slice(0, 5).map(a => getAnimeNews('trending'))); 
        }
      } catch (e) {
        console.warn("Pre-fetch failed, will load on demand:", e);
      }
    };
    prefetch();
  }, []);

  const [navigationStack, setNavigationStack] = useState<string[]>(['home']);
  const [selectedAnimeId, setSelectedAnimeId] = useState<number | null>(null);
  const [selectedNews, setSelectedNews] = useState<any>(null);

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme(localStorage.getItem('theme') || 'dark');
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  // Sync activeTab with stack top
  useEffect(() => {
    const currentPath = navigationStack[navigationStack.length - 1];
    if (['home', 'news', 'aniplay', 'anibase', 'settings', 'admin'].includes(currentPath)) {
       setActiveTab(currentPath);
    } else if (currentPath.startsWith('anime-')) {
       setActiveTab('anibase');
    }
  }, [navigationStack]);

  const navigateTo = (path: string) => {
    if (path === 'admin') {
      const newStack = [...navigationStack, 'admin'];
      window.history.pushState({ stackIdx: newStack.length - 1 }, '');
      setNavigationStack(newStack);
      return;
    }
    
    if (path === 'home') {
        window.history.replaceState({ stackIdx: 0 }, '');
        setNavigationStack(['home']);
        return;
    }
    
    if (['home', 'news', 'aniplay', 'anibase', 'settings'].includes(path)) {
      window.history.replaceState({ stackIdx: 0 }, '');
      setNavigationStack([path]);
    } else if (path.startsWith('anime-')) {
      const id = parseInt(path.split('-')[1]);
      setSelectedAnimeId(id);
      const newStack = [...navigationStack, path];
      window.history.pushState({ stackIdx: newStack.length - 1 }, '');
      setNavigationStack(newStack);
    }
  };

  const goBack = () => {
    if (navigationStack.length > 1) {
      window.history.back();
    } else {
        // If at home, we don't have a history to pop.
        const confirmExit = window.confirm("Press OK to exit the app.");
        if (confirmExit) {
            window.close(); // Not always allowed, but indicates intent.
        }
    }
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state;
      if (state && typeof state.stackIdx === 'number') {
        const targetIdx = state.stackIdx;
        setNavigationStack((prevStack) => {
          if (targetIdx < prevStack.length - 1) {
            // We popped back in history
            const newStack = prevStack.slice(0, targetIdx + 1);
            const prevPath = newStack[newStack.length - 1];
            if (prevPath && prevPath.startsWith('anime-')) {
              const id = parseInt(prevPath.split('-')[1]);
              setSelectedAnimeId(id);
            }
            return newStack;
          }
          return prevStack;
        });
      } else if (state && state.screen === 'saved-anime') {
          // If we popped into 'saved-anime', ensure it's handled if needed.
          // But our AniBaseScreen manages it.
      } else {
        // If no recognizable state, maybe it just closed the view?
        // AniBaseScreen needs to be notified if it's open.
        window.dispatchEvent(new CustomEvent('popstate-external', { detail: state }));
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initial setup
    window.history.replaceState({ stackIdx: 0 }, '');

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const currentPath = navigationStack[navigationStack.length - 1];

  const renderOverlay = () => {
    if (currentPath === 'admin') {
      return (
        <motion.div
          key="admin-overlay"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-50 bg-black min-h-screen overflow-y-auto"
        >
          <AdminUploadScreen onBack={goBack} />
        </motion.div>
      );
    }
    
    if (currentPath.startsWith('anime-') && selectedAnimeId) {
      return (
        <motion.div
          key={`anime-details-${selectedAnimeId}`}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 z-50 bg-[#080808] min-h-screen overflow-y-auto"
        >
          <AnimeDetailsScreen animeId={selectedAnimeId} onBack={goBack} onNavigate={(id) => navigateTo(`anime-${id}`)} />
        </motion.div>
      );
    }

    return null;
  };

  return (
    <div className={`min-h-screen ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'} font-sans selection:bg-cyan-500/30 overflow-x-hidden`}>
      <main className={`max-w-lg mx-auto ${theme === 'dark' ? 'bg-black' : 'bg-white'} min-h-screen relative shadow-2xl`}>
        <div className={`pb-24 ${(currentPath.startsWith('anime-') || currentPath === 'admin') ? 'hidden' : 'block'}`}>
          <div style={{display: activeTab === 'home' ? 'block' : 'none'}}><HomeScreen onNavigate={navigateTo} setSelectedNewsItem={setSelectedNews} /></div>
          <div style={{display: activeTab === 'news' ? 'block' : 'none'}}><NewsScreen selectedNewsItem={selectedNews} onClearSelection={() => setSelectedNews(null)} /></div>
          <div style={{display: activeTab === 'aniplay' ? 'block' : 'none'}}><AniPlayScreen /></div>
          <div style={{display: activeTab === 'anibase' ? 'block' : 'none'}}><AniBaseScreen onSelectAnime={(id) => navigateTo(`anime-${id}`)} /></div>
          <div style={{display: activeTab === 'settings' ? 'block' : 'none'}}><SettingsScreen onNavigate={navigateTo} /></div>
        </div>

        <AnimatePresence mode="wait">
          {renderOverlay()}
        </AnimatePresence>

        {!(currentPath.startsWith('anime-') || currentPath === 'admin') && (
          <BottomNav currentTab={activeTab} setTab={navigateTo} />
        )}
      </main>
    </div>
  );
}


import { Search, X, Plus, Play, Pause, ArrowLeft, RefreshCw, AlertCircle, History, Trash2, Loader2, Share2, SkipBack, SkipForward, Maximize } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import ReactPlayer from 'react-player';
import AppLogo from '../components/AppLogo';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, orderBy, getDocs, limit, startAfter, Query, QueryDocumentSnapshot, DocumentData, where, onSnapshot } from 'firebase/firestore';
import { AniPlayVideo } from '../types';
import PullToRefresh from '../components/PullToRefresh';

const BATCH_SIZE = 18;

interface AniPlayScreenProps {
  onBack?: () => void;
}

const CATEGORIES = ['ALL', 'VIDEOS', 'GENRES', 'ANIME UPDATES', 'EPISODES RATINGS'];

/**
 * Transformation helper to ensure MEGA links can be read or embedded correctly.
 */
const getStreamableUrl = (url: string) => {
  if (!url) return '';
  
  // Handle MEGA links robustly (supports standard, legacy, and embed formats)
  if (url.includes('mega.nz')) {
    // Standard format: mega.nz/file/ID#KEY
    if (url.includes('/file/')) {
        const parts = url.split('/file/')[1]?.split('#');
        if (parts && parts[0] && parts[1]) {
           return `https://mega.nz/embed/${parts[0]}#${parts[1]}`;
        }
    }
    // Legacy format: mega.nz/#!ID!KEY
    if (url.includes('/#!')) {
       const parts = url.split('/#!')[1]?.split('!');
       if (parts?.[0] && parts?.[1]) {
          return `https://mega.nz/embed/${parts[0]}#${parts[1]}`;
       }
    }
    // Already an embed format
    if (url.includes('/embed/')) {
      return url;
    }
  }
  
  return url;
};

const ThumbnailImage = ({ src, alt, className }: { src?: string; alt: string; className: string }) => {
  const [error, setError] = useState(false);

  if (!src || error) {
    return (
      <div className={`${className} flex flex-col items-center justify-center bg-obsidian-950 text-indigo-500/20`}>
        <Play size={48} />
      </div>
    );
  }

  return (
    <img 
      src={src} 
      className={className} 
      alt={alt}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
};

export default function AniPlayScreen({ onBack }: AniPlayScreenProps) {
  const [videos, setVideos] = useState<AniPlayVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'player'>('grid');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const loaderRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleRefresh = async () => {
    await loadVideos(true);
    // Visual feedback delay
    await new Promise(r => setTimeout(r, 400));
  };

  useEffect(() => {
    const q = query(collection(db, 'aniplay'), orderBy('createdAt', 'desc'), limit(BATCH_SIZE * 3));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newVideos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AniPlayVideo));
      setVideos(newVideos);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === BATCH_SIZE * 3);
      setLoading(false);
    }, (error) => {
        handleFirestoreError(error, OperationType.LIST, 'aniplay');
    });

    // Load search history
    const saved = localStorage.getItem('aniplay_search_history');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse search history", e);
      }
    }
    return () => unsubscribe();
  }, []); // Run only on mount

  const loadVideos = async (isInitial = false) => {
    if (fetchingMore || (!isInitial && !hasMore)) return;

    if (!isInitial) {
        setFetchingMore(true);
        try {
            let q: Query<DocumentData> = collection(db, 'aniplay');
            q = query(q, orderBy('createdAt', 'desc'), limit(BATCH_SIZE), startAfter(lastDoc));
            
            const snapshot = await getDocs(q);
            const newVideos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AniPlayVideo));
            
            setVideos(prev => [...prev, ...newVideos]);
            setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
            setHasMore(snapshot.docs.length === BATCH_SIZE);
        } catch (error) {
            handleFirestoreError(error, OperationType.LIST, 'aniplay');
        } finally {
            setFetchingMore(false);
        }
    }
  };

  useEffect(() => {
    // Click outside handler for history dropdown
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []); // Removed activeCategory dependency since it doesn't use it

  const handleSearch = (e?: React.FormEvent, term?: string) => {
    if (e) e.preventDefault();
    const finalTerm = term !== undefined ? term : searchQuery;
    if (!finalTerm.trim()) return;

    setSearchQuery(finalTerm);
    setShowHistory(false);

    setSearchHistory(prev => {
      const history = prev.filter(q => q.toLowerCase() !== finalTerm.toLowerCase());
      const newHistory = [finalTerm, ...history].slice(0, 10);
      localStorage.setItem('aniplay_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const clearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory([]);
    localStorage.removeItem('aniplay_search_history');
  };

  const removeHistoryItem = (e: React.MouseEvent, term: string) => {
    e.stopPropagation();
    setSearchHistory(prev => {
      const newHistory = prev.filter(item => item !== term);
      localStorage.setItem('aniplay_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  // Intersection Observer for grid view
  useEffect(() => {
    if (viewMode !== 'grid') return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !fetchingMore && !loading) {
        loadVideos();
      }
    }, { threshold: 0.1 });

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => observer.disconnect();
  }, [viewMode, hasMore, fetchingMore, loading, lastDoc]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'ALL': 0,
      'VIDEOS': 0,
      'GENRES': 0,
      'ANIME UPDATES': 0,
      'EPISODES RATINGS': 0
    };

    videos.forEach(v => {
      const cat = v.category.toUpperCase();
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    });
    counts['ALL'] = videos.length;

    return counts;
  }, [videos]);

  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
      const catMatch = (activeCategory === 'ALL' && v.category !== 'Videos') || 
                       v.category.toUpperCase() === activeCategory || 
                       (activeCategory === 'GENRES' && v.category === 'Genres') ||
                       (activeCategory === 'ANIME UPDATES' && v.category === 'Anime Updates') ||
                       (activeCategory === 'EPISODES RATINGS' && v.category === 'Episodes Ratings');
      return matchesSearch && catMatch;
    });
  }, [videos, searchQuery, activeCategory]);

  useEffect(() => {
    // If the local filter starves and we have more, automatically fetch next batch
    if (viewMode === 'grid' && filteredVideos.length < 4 && hasMore && !fetchingMore && !loading) {
      loadVideos();
    }
  }, [filteredVideos.length, hasMore, fetchingMore, loading, viewMode]);

  const handleOpenVideo = (index: number) => {
    setCurrentIndex(index);
    setViewMode('player');
    window.history.pushState({ screen: 'aniplay-player' }, '');
  };

  useEffect(() => {
    const handlePopStateExternal = (event: any) => {
      if (viewMode === 'player' && event.detail?.screen !== 'aniplay-player') {
        setViewMode('grid');
      }
    };
    window.addEventListener('popstate-external', handlePopStateExternal);
    return () => window.removeEventListener('popstate-external', handlePopStateExternal);
  }, [viewMode]);

  const handleClosePlayer = () => {
    if (window.history.state?.screen === 'aniplay-player') {
      window.history.back();
    }
    setViewMode('grid');
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col overflow-hidden">
      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div 
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col bg-black overflow-y-auto no-scrollbar pb-24"
            ref={scrollContainerRef}
          >
            <PullToRefresh onRefresh={handleRefresh} scrollRef={scrollContainerRef}>
              {/* Header section matches screenshot */}
            <div className="p-6 pt-10 space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <AppLogo className="w-12 h-12" size={24} />
                  <h1 className="text-white font-black text-4xl tracking-tighter uppercase italic">ANIPLAY</h1>
                </div>
                <div className="flex flex-col items-center">
                  <div className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-1 text-center">Total Intelligence</div>
                  <div className="px-4 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-black text-sm shadow-[inset_0_0_15px_rgba(99,102,241,0.05)] text-center">
                    {videos.length} <span className="text-[10px] text-indigo-500/50">VIDS</span>
                  </div>
                </div>
              </div>

              {/* Search Bar matching screenshot features */}
              <div ref={searchContainerRef} className="relative group z-30 flex items-center">
                <Search className="absolute left-6 text-gray-500 group-focus-within:text-white transition-colors" size={22} />
                <input 
                  type="text"
                  placeholder="Search for anime by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowHistory(true)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-full bg-obsidian-950 border border-white/5 rounded-3xl py-5 pl-16 pr-20 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500/50 transition-all font-medium text-lg"
                />
                <button 
                  onClick={() => handleSearch()}
                  className="absolute right-3 w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 hover:text-white hover:bg-white/10 transition-all active:scale-90"
                >
                  <Search size={20} />
                </button>

                <AnimatePresence>
                  {showHistory && searchHistory.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-obsidian-900 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-xl"
                    >
                      <div className="flex justify-between items-center px-5 py-3 border-b border-white/5 bg-white/5">
                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Recent Searches</span>
                        <button 
                          onClick={clearHistory}
                          className="flex items-center gap-1.5 text-[9px] font-black text-rose-500 hover:text-rose-400 uppercase tracking-widest transition-colors"
                        >
                          <Trash2 size={10} />
                          Clear All
                        </button>
                      </div>
                      <div className="max-h-[300px] overflow-y-auto no-scrollbar py-2">
                        {searchHistory.map((item, index) => (
                          <div 
                            key={index}
                            className="flex items-center justify-between px-5 py-3.5 hover:bg-white/5 cursor-pointer group transition-all"
                            onClick={() => handleSearch(undefined, item)}
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-indigo-400 transition-colors shrink-0">
                                <History size={14} />
                              </div>
                              <span className="text-sm font-medium text-gray-400 group-hover:text-white transition-colors truncate">{item}</span>
                            </div>
                            <button
                              onClick={(e) => removeHistoryItem(e, item)}
                              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-600 hover:text-rose-500 hover:bg-rose-500/10 transition-all shrink-0"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Filter Chips horizontal scroll */}
              <div className="flex overflow-x-auto no-scrollbar gap-2 -mx-6 px-6">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-none whitespace-nowrap shrink-0 flex items-center gap-2 ${
                      activeCategory === cat 
                        ? 'bg-indigo-500 text-black shadow-[0_0_25px_rgba(99,102,241,0.4)]' 
                        : 'bg-obsidian-900 text-gray-400 hover:text-white hover:bg-obsidian-800'
                    }`}
                  >
                    <span>{cat}</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black border ${
                      activeCategory === cat 
                        ? 'bg-black/20 border-black/10 text-black/80' 
                        : 'bg-white/5 border-white/10 text-gray-500'
                    }`}>
                      {categoryCounts[cat] || 0}
                    </span>
                  </button>
                ))}
              </div>

              {/* Discovery Grid */}
              {loading ? (
                <div className="py-20 flex flex-col items-center justify-center opacity-20 gap-4">
                  <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Synchronizing...</span>
                </div>
              ) : filteredVideos.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                   <Plus size={64} className="text-gray-600 opacity-20" />
                   <span className="text-sm font-black uppercase tracking-[0.2em] text-gray-500 opacity-40">No AniPlay Found</span>
                </div>
              ) : (
                <div className={`grid ${activeCategory === 'VIDEOS' ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'} gap-x-5 gap-y-10 pb-10`}>
                  {filteredVideos.map((video, idx) => (
                    <motion.div 
                      key={video.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleOpenVideo(idx)}
                      className="flex flex-col gap-4 group cursor-pointer"
                    >
                      <div className={`${activeCategory === 'VIDEOS' ? 'aspect-video rounded-3xl' : 'aspect-[10/14] rounded-[2.5rem]'} bg-obsidian-900 overflow-hidden relative border border-white/5 shadow-2xl transition-transform group-hover:scale-[1.02]`}>
                        <ThumbnailImage 
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                        
                        {/* Play Icon Overlay (Top-Right) */}
                        <div className="absolute top-5 right-5 w-9 h-9 rounded-full bg-indigo-500/90 backdrop-blur-md text-black flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform active:scale-95 group-hover:bg-indigo-400">
                          <Play size={16} fill="currentColor" className="ml-0.5" />
                        </div>

                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      
                      <div className="px-1">
                        <h3 className="text-white font-black text-[14px] leading-tight tracking-tight group-hover:text-indigo-400 transition-colors mb-1">
                          {video.title}
                        </h3>
                        {activeCategory !== 'VIDEOS' && (
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">
                              {video.category.toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Infinite Scroll Loader for Grid */}
              <div ref={loaderRef} className="h-20 flex items-center justify-center">
                {fetchingMore && (
                  <div className="flex flex-col items-center gap-2 opacity-40">
                    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400">Loading more...</span>
                  </div>
                )}
              </div>
            </div>
            </PullToRefresh>
          </motion.div>
        ) : (
          <motion.div 
            key="player"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex-1 flex flex-col"
          >
            <PlayerView 
              videos={filteredVideos} 
              startIndex={currentIndex} 
              activeCategory={activeCategory}
              onClose={handleClosePlayer} 
              onLoadMore={() => loadVideos()}
              fetchingMore={fetchingMore}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlayerView({ videos, startIndex, activeCategory, onClose, onLoadMore, fetchingMore }: { 
  videos: AniPlayVideo[], 
  startIndex: number, 
  activeCategory: string,
  onClose: () => void,
  onLoadMore: () => void,
  fetchingMore: boolean
}) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const controlsTimerRef = useRef<NodeJS.Timeout | null>(null);

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2000);
  };

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [currentIndex]);

  // Preload window: current, previous, and next
  const renderedIndices = useMemo(() => {
    const indices = [];
    for (let i = currentIndex - 1; i <= currentIndex + 1; i++) {
      if (i >= 0 && i < videos.length) {
        indices.push(i);
      }
    }
    return indices;
  }, [currentIndex, videos.length]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollPos = e.currentTarget.scrollTop;
    const height = e.currentTarget.clientHeight;
    if (height === 0) return;
    const index = Math.round(scrollPos / height);
    if (index !== currentIndex && index >= 0 && index < videos.length) {
      setCurrentIndex(index);
    }
    
    // Trigger load more if we are near the end of current list
    if (index >= videos.length - 2 && !fetchingMore) {
      onLoadMore();
    }
    resetControlsTimer();
  };

  return (
    <div 
      className="flex-1 relative bg-black overflow-hidden h-[calc(100vh-80px)] w-screen"
      onClick={resetControlsTimer}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
    >
      <motion.div 
        animate={{ opacity: showControls ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        className="absolute top-6 left-6 z-[200] pointer-events-none"
      >
        <button 
          onClick={onClose}
          className="pointer-events-auto w-14 h-14 rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/10 flex items-center justify-center text-white active:scale-90 transition-all shadow-2xl"
        >
          <ArrowLeft size={28} />
        </button>
      </motion.div>

      <div 
        ref={containerRef}
        className={`h-full w-full no-scrollbar pb-20 ${activeCategory === 'VIDEOS' ? 'overflow-hidden' : 'overflow-y-scroll snap-y snap-mandatory'}`}
        onScroll={activeCategory !== 'VIDEOS' ? handleScroll : undefined}
      >
        {videos.map((video, index) => {
          // Render a placeholder for non-window videos to keep scroll height
          const isRendered = renderedIndices.includes(index);
          const isActive = index === currentIndex;
          const isNear = Math.abs(index - currentIndex) <= 1;

          return (
            <div key={video.id} className={`${activeCategory === 'VIDEOS' ? 'h-full flex items-center justify-center' : 'h-full snap-start'} w-full relative`}>
              {isRendered ? (
                <VideoItem 
                  video={video} 
                  isActive={isActive}
                  isLandscape={activeCategory === 'VIDEOS'}
                  isPreload={isNear && !isActive}
                  muted={isMuted}
                  showControls={showControls}
                  resetControlsTimer={resetControlsTimer}
                  onToggleMute={() => setIsMuted(!isMuted)}
                />
              ) : (
                <div className="h-full w-full bg-black" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const VideoItem = memo(({ video, isActive, isLandscape, isPreload, muted, showControls, resetControlsTimer, onToggleMute }: { 
  video: AniPlayVideo; 
  isActive: boolean; 
  isLandscape?: boolean;
  isPreload?: boolean;
  muted: boolean;
  showControls: boolean;
  resetControlsTimer: () => void;
  onToggleMute: () => void;
}) => {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const playerRef = useRef<any>(null);
  const Player = ReactPlayer as any;
  
  const streamUrl = useMemo(() => getStreamableUrl(video.url), [video.url, retryCount]);
  const isMega = useMemo(() => streamUrl.includes('mega.nz/embed'), [streamUrl]);

  // Reset states when URL changes Or Manual Retry
  useEffect(() => {
    setReady(false);
    setError(false);
  }, [streamUrl, retryCount]);

  const handleRetry = () => {
    setError(false);
    setReady(false);
    setRetryCount(prev => prev + 1);
  };

  const megaIframeUrl = useMemo(() => {
    if (!isMega) return '';
    // Use stable URL to allow the iframe to load even when not active
    // This prevents reloads when the video becomes active as the src remains constant
    return streamUrl;
  }, [streamUrl, isMega]);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [localPlaying, setLocalPlaying] = useState(isActive);
  useEffect(() => {
    setLocalPlaying(isActive);
  }, [isActive]);
  
  const [isBuffering, setIsBuffering] = useState(false);

  return (
    <div 
      ref={containerRef} 
      className="h-full w-full relative bg-black overflow-hidden flex flex-col items-center justify-center"
      onClick={(e) => {
        // Toggle mute only if controls are visible and not isMega
        if (showControls && !isMega) {
          onToggleMute();
        }
        resetControlsTimer();
      }}
    >
      {/* Player Implementation */}
      <div className={`z-0 flex items-center justify-center shrink min-h-0 ${isLandscape ? 'w-full max-h-[65vh] md:max-h-[70vh] aspect-video' : 'absolute inset-0 w-full h-full object-cover aspect-[9/16]'}`}>
        {isMega ? (
          <div className="relative w-full h-full overflow-hidden">
            <iframe
              key={`mega-${retryCount}`}
              src={megaIframeUrl}
              style={{
                position: 'absolute',
                top: '-65px',
                left: '-2%',
                width: '104%',
                height: 'calc(100% + 90px)', // Adjusted to show bottom seek bar
              }}
              className={`border-none transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0'}`}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              onLoad={() => {
                // Zero-latency: resolve immediately on load
                Promise.resolve().then(() => setReady(true));
              }}
            />
          </div>
        ) : (
          <div className="w-full h-full relative">
            <Player
              ref={playerRef}
              url={streamUrl}
              playing={localPlaying}
              loop={true}
              muted={muted}
              width="100%"
              height="100%"
              playsInline
              onReady={() => {
                // Zero-latency: wrap ready state to trigger play in earliest microtask
                Promise.resolve().then(() => setReady(true));
              }}
              onWaiting={() => setIsBuffering(true)}
              onPlaying={() => setIsBuffering(false)}
              onDurationChange={(e: any) => setDuration(e.currentTarget?.duration || 0)}
              onTimeUpdate={(e: any) => setPlayedSeconds(e.currentTarget?.currentTime || 0)}
              onError={(e: any) => {
                console.error("Video error:", e);
                setError(true);
              }}
              config={{
                file: {
                  attributes: {
                    style: { width: '100%', height: '100%', objectFit: 'cover' },
                    controlsList: 'nodownload',
                    preload: 'auto',
                    // Enhance buffering behavior
                    crossOrigin: 'anonymous'
                  },
                  forceVideo: true,
                  // Request higher quality if possible or handle MP4 efficiently
                  hlsOptions: {
                    maxBufferLength: 10,
                    enableWorker: true
                  }
                }
              } as any}
            />
            {/* Buffering Indicator */}
            <AnimatePresence>
              {isBuffering && isActive && !error && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm pointer-events-none z-10"
                >
                  <Loader2 className="w-12 h-12 text-white animate-spin opacity-80" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Title display at the top */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: (ready && isActive && showControls) ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        className="absolute top-0 left-0 right-0 z-20 p-4 pt-8 pointer-events-none bg-gradient-to-b from-black/80 via-black/40 to-transparent flex justify-center"
      >
        <h2 className="text-white text-base sm:text-lg font-bold text-center drop-shadow-md px-4 max-w-3xl leading-tight opacity-90">
          {video.title}
        </h2>
      </motion.div>

      {/* Persistent Custom Controls with Auto-Hide */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: (ready && isActive && showControls) ? 1 : 0 }}
        transition={{ duration: 0.5 }}
        className={isLandscape ? "w-full max-w-2xl px-6 mt-6 pb-12 z-20 pointer-events-none shrink-0" : "absolute bottom-0 left-0 right-0 z-20 px-6 pb-36 mb-4 pointer-events-none"}
      >
        <div className="w-full space-y-5 pointer-events-auto drop-shadow-[0_4px_10px_rgba(0,0,0,0.8)]">
          {!isMega && (
            <>
              {/* Seek Bar */}
              <div className="relative w-full h-2 bg-white/5 rounded-full overflow-hidden group cursor-pointer">
                <motion.div 
                  className="absolute inset-y-0 left-0 bg-indigo-500 rounded-full shadow-[0_0_20px_rgba(99,102,241,0.6)]" 
                  layout
                  initial={{ width: 0 }}
                  animate={{ width: `${(playedSeconds / duration) * 100 || 0}%` }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
                <input 
                  type="range"
                  min={0}
                  max={duration || 0}
                  step="any"
                  value={playedSeconds}
                  onChange={(e) => {
                    const time = parseFloat(e.target.value);
                    setPlayedSeconds(time);
                    playerRef.current?.seekTo(time);
                    resetControlsTimer();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full"
                />
              </div>
            </>
          )}
          
          {/* Controls */}
          <div className="flex items-center justify-center">
            
            <div className={`flex items-center ${isMega ? 'gap-4': 'gap-2'}`}>
              {!isMega && (
                <>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      playerRef.current?.seekTo(Math.max(playedSeconds - 10, 0));
                      resetControlsTimer();
                    }}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-90 border border-white/5 block"
                  >
                    <SkipBack size={18} />
                  </button>

                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setLocalPlaying(!localPlaying);
                      resetControlsTimer();
                    }}
                    className="p-3 rounded-2xl bg-indigo-500 hover:bg-indigo-400 text-white transition-all active:scale-90 border border-indigo-400/30 shadow-[0_0_15px_rgba(99,102,241,0.4)]"
                  >
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={localPlaying ? 'pause' : 'play'}
                        initial={{ scale: 0.8, opacity: 0, rotate: -90 }}
                        animate={{ scale: 1, opacity: 1, rotate: 0 }}
                        exit={{ scale: 0.8, opacity: 0, rotate: 90 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                      >
                        {localPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                      </motion.div>
                    </AnimatePresence>
                  </button>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      playerRef.current?.seekTo(Math.min(playedSeconds + 10, duration));
                      resetControlsTimer();
                    }}
                    className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-90 border border-white/5 block"
                  >
                    <SkipForward size={18} />
                  </button>

                  <div className="w-[1px] h-6 bg-white/10 mx-1 block" />
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {error && isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-xl z-30 p-12 text-center animate-in fade-in duration-500">
          <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mb-8 border border-red-500/20">
            <AlertCircle className="text-red-500" size={48} />
          </div>
          <h3 className="text-white font-black text-2xl mb-4 tracking-tight uppercase italic">Transmission Interrupted</h3>
          <p className="text-gray-500 text-sm font-bold uppercase tracking-widest max-w-[280px] mb-10 leading-relaxed">
             We couldn't decrypt the signal from the provider. Remote source might be offline.
          </p>
          <button 
            onClick={handleRetry}
            className="flex items-center gap-3 bg-white text-black px-8 py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-indigo-500 hover:text-white transition-all active:scale-95 shadow-[0_10px_40px_rgba(255,255,255,0.1)]"
          >
            <RefreshCw size={18} />
            Reconnect Signal
          </button>
        </div>
      )}


    </div>
  );
});

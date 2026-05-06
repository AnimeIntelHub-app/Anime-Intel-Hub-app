import { Search, X, Plus, Play, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import ReactPlayer from 'react-player';
import AppLogo from '../components/AppLogo';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { AniPlayVideo } from '../types';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'player'>('grid');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const q = query(collection(db, 'aniplay'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AniPlayVideo)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'aniplay');
      setLoading(false);
    });
    return unsub;
  }, []);

  const filteredVideos = useMemo(() => {
    return videos.filter(v => {
      const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
      const catMatch = activeCategory === 'ALL' || 
                       v.category.toUpperCase() === activeCategory || 
                       (activeCategory === 'GENRES' && v.category === 'Genres') ||
                       (activeCategory === 'ANIME UPDATES' && v.category === 'Anime Updates') ||
                       (activeCategory === 'EPISODES RATINGS' && v.category === 'Episodes Ratings');
      return matchesSearch && catMatch;
    });
  }, [videos, searchQuery, activeCategory]);

  const handleOpenVideo = (index: number) => {
    setCurrentIndex(index);
    setViewMode('player');
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
          >
            {/* Header section matches screenshot */}
            <div className="p-6 pt-10 space-y-8">
              <div className="flex items-center gap-4">
                <AppLogo className="w-12 h-12" size={24} />
                <h1 className="text-white font-black text-4xl tracking-tighter uppercase italic">ANIPLAY</h1>
              </div>

              {/* Search Bar matching screenshot */}
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-white transition-colors" size={22} />
                <input 
                  type="text"
                  placeholder="Search for videos..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-obsidian-950 border border-white/5 rounded-3xl py-5 pl-16 pr-6 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all font-medium text-lg"
                />
              </div>

              {/* Filter Chips matching screenshot */}
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-none ${
                      activeCategory === cat 
                        ? 'bg-indigo-500 text-black shadow-[0_0_25px_rgba(99,102,241,0.4)]' 
                        : 'bg-obsidian-900 text-gray-400 hover:text-white hover:bg-obsidian-800'
                    }`}
                  >
                    {cat}
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
                <div className="grid grid-cols-2 gap-x-5 gap-y-10 pb-10">
                  {filteredVideos.map((video, idx) => (
                    <motion.div 
                      key={video.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => handleOpenVideo(idx)}
                      className="flex flex-col gap-4 group cursor-pointer"
                    >
                      <div className="aspect-[10/14] rounded-[2.5rem] bg-obsidian-900 overflow-hidden relative border border-white/5 shadow-2xl transition-transform group-hover:scale-[1.02]">
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
                        <h3 className="text-white font-black text-[14px] leading-tight tracking-tight group-hover:text-indigo-400 transition-colors line-clamp-1 mb-1">
                          {video.title}
                        </h3>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">
                            {video.category.toUpperCase()}
                          </span>
                          <div className="w-1.5 h-1.5 rounded-full bg-gray-800" />
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest leading-none">
                            GENRES
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
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
              onClose={() => setViewMode('grid')} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlayerView({ videos: data, startIndex, onClose }: { videos: AniPlayVideo[], startIndex: number, onClose: () => void }) {
  const [videos] = useState(data);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

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
  };

  return (
    <div className="flex-1 relative bg-black overflow-hidden h-[calc(100vh-80px)] w-screen">
      <div className="absolute top-0 left-0 right-0 p-8 pt-12 z-[200] flex items-center justify-between pointer-events-none">
        <button 
          onClick={onClose}
          className="pointer-events-auto w-14 h-14 rounded-3xl bg-black/40 backdrop-blur-2xl border border-white/10 flex items-center justify-center text-white active:scale-90 transition-all shadow-[0_0_30px_rgba(0,0,0,0.5)]"
        >
          <ArrowLeft size={28} />
        </button>
      </div>

      <div 
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar pb-20"
        onScroll={handleScroll}
      >
        {videos.map((video, index) => {
          // Render a placeholder for non-window videos to keep scroll height
          const isRendered = renderedIndices.includes(index);
          const isActive = index === currentIndex;
          const isNear = Math.abs(index - currentIndex) <= 1;

          return (
            <div key={video.id} className="h-full w-full snap-start relative">
              {isRendered ? (
                <VideoItem 
                  video={video} 
                  isActive={isActive}
                  isPreload={isNear && !isActive}
                  muted={isMuted}
                  onToggleMute={() => setIsMuted(!isMuted)}
                />
              ) : (
                <div className="h-full w-full bg-black flex items-center justify-center">
                   <div className="w-10 h-10 border-2 border-white/5 rounded-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const VideoItem = memo(({ video, isActive, isPreload, muted, onToggleMute }: { 
  video: AniPlayVideo; 
  isActive: boolean; 
  isPreload?: boolean;
  muted: boolean;
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
    const [baseUrl, fragment] = streamUrl.split('#');
    // Aggressive load: iframe is active if we are in the rendered window
    // Autoplay is true if we are the current active video
    return `${baseUrl}?autoplay=${isActive ? 1 : 0}&mute=${muted ? 1 : 0}${fragment ? '#' + fragment : ''}`;
  }, [streamUrl, isMega, muted, isActive]);

  return (
    <div className="h-full w-full relative bg-black overflow-hidden flex items-center justify-center">
      {/* Player Implementation */}
      <div className="absolute inset-0 z-0 flex items-center justify-center">
        {isMega ? (
          <div className="relative w-full h-full">
            <iframe
              key={`mega-${retryCount}`}
              src={megaIframeUrl}
              className={`w-full h-full border-none transition-opacity duration-700 ${isActive ? 'opacity-100' : 'opacity-0'}`}
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              onLoad={() => {
                // Zero-latency: resolve immediately on load
                Promise.resolve().then(() => setReady(true));
              }}
            />
            <div className="absolute top-0 right-0 w-44 h-16 bg-black z-10 pointer-events-none" />
            <div className="absolute top-0 left-0 w-full h-12 bg-black z-10 pointer-events-none" />
          </div>
        ) : (
          <Player
            ref={playerRef}
            url={streamUrl}
            playing={isActive}
            loop={true}
            muted={muted}
            width="100%"
            height="100%"
            playsinline
            onReady={() => {
              // Zero-latency: wrap ready state to trigger play in earliest microtask
              Promise.resolve().then(() => setReady(true));
            }}
            onError={(e: any) => {
              console.error("Video error:", e);
              setError(true);
            }}
            config={{
              file: {
                attributes: {
                  style: { width: '100%', height: '100%', objectFit: 'cover' },
                  controlsList: 'nodownload',
                  preload: 'auto'
                },
                forceVideo: true
              }
            } as any}
          />
        )}
      </div>

      <div className="absolute top-12 left-0 right-0 z-20 flex justify-center pointer-events-none">
        <span className="text-white font-black text-sm tracking-widest truncate block drop-shadow-[0_2px_10px_rgba(0,0,0,1)] px-4">
          {video.title}
        </span>
      </div>

      {isActive && !isMega && (
        <div 
          className="absolute inset-0 z-10 cursor-pointer" 
          onClick={onToggleMute}
        />
      )}

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

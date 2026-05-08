import { Search, Info, Calendar, PlayCircle, Star, History, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useEffect, useState, useRef } from 'react';
import { searchAnime, getPopularAnime, onCacheUpdate, getAnimeById } from '../services/animeService';
import { Anime } from '../types';
import PullToRefresh from '../components/PullToRefresh';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

interface AniBaseScreenProps {
  onSelectAnime: (id: number) => void;
}

export default function AniBaseScreen({ onSelectAnime }: AniBaseScreenProps) {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  const [savedAnime, setSavedAnime] = useState<Anime[]>([]);

  const setShowSavedAndPushHistory = (show: boolean) => {
    if (show) {
      window.history.pushState({ screen: 'saved-anime' }, '');
      setShowSaved(true);
    } else {
      if (window.history.state?.screen === 'saved-anime') {
        window.history.back();
      }
      setShowSaved(false);
    }
  };

  useEffect(() => {
    const handlePopStateExternal = (event: any) => {
      if (event.detail?.screen !== 'saved-anime') {
        setShowSaved(false);
      }
    };
    window.addEventListener('popstate-external', handlePopStateExternal);
    return () => window.removeEventListener('popstate-external', handlePopStateExternal);
  }, []);
  const [results, setResults] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(false);
  const [popular, setPopular] = useState<Anime[]>([]);
  const [catalogBatch, setCatalogBatch] = useState(0);
  const [searchBatch, setSearchBatch] = useState(0);

  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  
  // Refs for auto-refresh to avoid stale closures in setInterval
  const submittedQueryRef = useRef(submittedQuery);
  const filterTypeRef = useRef(filterType);
  const filterStatusRef = useRef(filterStatus);

  useEffect(() => {
    submittedQueryRef.current = submittedQuery;
    filterTypeRef.current = filterType;
    filterStatusRef.current = filterStatus;
  }, [submittedQuery, filterType, filterStatus]);

  useEffect(() => {
    // Listen for background cache updates
    const unsubscribe = onCacheUpdate((key, data) => {
      if (key === 'popular_anime') {
        setPopular(data || []);
      }
    });

    const fetchPopular = (force = false) => {
      getPopularAnime(force).then(data => {
        setPopular(data || []);
        setLoading(false);
      }).catch(() => setLoading(false));
    };

    fetchPopular();
    const interval = setInterval(() => {
      if (submittedQueryRef.current) {
        searchAnime(submittedQueryRef.current, filterTypeRef.current, filterStatusRef.current)
          .then(data => setResults(data || []))
          .catch(err => console.error('Auto-refresh search failed:', err));
      } else {
        fetchPopular(true);
      }
    }, 60 * 60 * 1000);

    const savedHistory = localStorage.getItem('anime_search_history');
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (e) {
        setSearchHistory([]);
      }
    }

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (showSaved) {
      if (auth.currentUser) {
        fetchSavedAnime(auth.currentUser.uid);
      } else {
        fetchLocalSavedAnime();
      }
    }
  }, [showSaved]);

  const fetchLocalSavedAnime = async () => {
    setLoading(true);
    try {
      const savedIds = JSON.parse(localStorage.getItem('saved_anime') || '[]');
      const savedAnimeData = await Promise.all(savedIds.map((id: number) => getAnimeById(id)));
      setSavedAnime(savedAnimeData.filter(anime => anime !== null) as Anime[]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedAnime = async (userId: string) => {
    setLoading(true);
    try {
      const q = collection(db, 'users', userId, 'collections');
      const snapshot = await getDocs(q);
      const saved = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          mal_id: data.animeId,
          title: data.title,
          images: { jpg: { large_image_url: data.imageUrl, image_url: data.imageUrl } },
          // Fill other required fields with defaults to make Anime interface happy
          title_english: data.title,
          synopsis: '',
          genres: [],
          status: '',
          year: 0,
          duration: '',
          rating: '',
          source: '',
          episodes: 0,
          type: '',
          studios: [],
          producers: [],
          themes: [],
          demographics: [],
          trailer: {
            youtube_id: '',
            url: '',
            embed_url: ''
          },
          score: 0,
          scored_by: 0,
          rank: 0,
          popularity: 0,
          members: 0,
          favorites: 0,
        } as Anime;
      });
      setSavedAnime(saved);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, `users/${userId}/collections`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (query) {
      searchAnime(query, filterType, filterStatus)
        .then(data => setResults(data || []))
        .catch(err => console.error('Failed to refresh search:', err));
    } else {
      getPopularAnime(true)
        .then(data => setPopular(data || []))
        .catch(err => console.error('Failed to refresh popular:', err));
    }
    // Instant visual feedback
    await new Promise(r => setTimeout(r, 400));
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveToHistory = (searchQuery: string) => {
    const term = searchQuery.trim();
    if (!term) return;
    
    setSearchHistory(prev => {
      const history = prev.filter(q => q.toLowerCase() !== term.toLowerCase());
      const newHistory = [term, ...history].slice(0, 10);
      localStorage.setItem('anime_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  const handleSearch = async (e?: React.FormEvent, explicitQuery?: string, overrideType?: string, overrideStatus?: string) => {
    if (e) e.preventDefault();
    const termToSearch = (explicitQuery ?? query).trim();
    if (!termToSearch) return;
    
    setQuery(termToSearch);
    setSubmittedQuery(termToSearch);
    setShowSaved(false);
    setShowHistory(false);
    saveToHistory(termToSearch);
    
    setLoading(true);
    setSearchBatch(0);
    
    const activeType = overrideType !== undefined ? overrideType : filterType;
    const activeStatus = overrideStatus !== undefined ? overrideStatus : filterStatus;
    
    const data = await searchAnime(termToSearch, activeType, activeStatus);
    setResults(data || []);
    setLoading(false);
  };

  const clearSearch = () => {
    setQuery('');
    setSubmittedQuery('');
    setResults([]);
    setSearchBatch(0);
    setFilterType('');
    setFilterStatus('');
  };

  const clearHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchHistory([]);
    localStorage.removeItem('anime_search_history');
  };

  const removeHistoryItem = (e: React.MouseEvent, itemToRemove: string) => {
    e.stopPropagation();
    setSearchHistory(prev => {
      const newHistory = prev.filter(item => item !== itemToRemove);
      localStorage.setItem('anime_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="pb-24 pt-6 px-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-black text-white uppercase tracking-tighter">AniBase</h1>
        <button
          onClick={() => setShowSavedAndPushHistory(!showSaved)}
          className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap shrink-0 ${
            showSaved 
              ? 'bg-rose-500 text-black border-rose-500' 
              : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/10'
          }`}
        >
          Saved Anime
        </button>
      </div>

      <div className="space-y-4 mb-8">
        <div ref={searchContainerRef} className="relative group z-30 flex items-center">
          <form onSubmit={(e) => handleSearch(e)} className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-white transition-colors" size={18} />
            <input
              type="text"
              placeholder="Search for anime by title..."
              value={query}
              onChange={(e) => {
                const val = e.target.value;
                setQuery(val);
                if (!val.trim()) {
                  setSubmittedQuery('');
                  setResults([]);
                  setSearchBatch(0);
                }
              }}
              onFocus={() => setShowHistory(true)}
              className="w-full bg-obsidian-800 border border-white/5 rounded-2xl py-4 pl-12 pr-24 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all placeholder:text-gray-600 shadow-xl"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {query && (
                <button 
                  type="button"
                  onClick={clearSearch}
                  className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              )}
              <button 
                type="submit"
                className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-90"
              >
                <Search size={16} />
              </button>
            </div>
          </form>
          
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

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6">
          {[
            { label: 'Any Type', value: '' },
            { label: 'TV', value: 'tv' },
            { label: 'Movie', value: 'movie' },
            { label: 'OVA', value: 'ova' },
            { label: 'Special', value: 'special' }
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setFilterType(t.value);
                if (query) handleSearch(undefined, undefined, t.value);
              }}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap shrink-0 ${
                filterType === t.value 
                  ? 'bg-indigo-500 text-black border-indigo-500' 
                  : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/10'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-6 px-6">
          {[
            { label: 'Any Status', value: '' },
            { label: 'Airing', value: 'airing' },
            { label: 'Finished', value: 'complete' },
            { label: 'Upcoming', value: 'upcoming' }
          ].map((s) => (
            <button
              key={s.value}
              onClick={() => {
                setFilterStatus(s.value);
                if (query) handleSearch(undefined, undefined, undefined, s.value);
              }}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all whitespace-nowrap shrink-0 ${
                filterStatus === s.value 
                  ? 'bg-indigo-500 text-black border-indigo-500' 
                  : 'bg-white/5 text-gray-400 border-white/5 hover:border-white/10'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full"
          />
        </div>
      ) : showSaved ? (
        <div className="mb-10">
          <h2 className="text-xl font-bold text-white mb-6">Saved Anime</h2>
          {savedAnime.length === 0 ? (
            <p className="text-center text-gray-500">No saved anime found.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {savedAnime.map((anime) => (
                <AnimeCard key={`saved-${anime.mal_id}`} anime={anime} onClick={() => onSelectAnime(anime.mal_id)} />
              ))}
            </div>
          )}
        </div>
      ) : submittedQuery && (results || []).length > 0 ? (
        <div className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-white">Search Results</h2>
            <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar max-w-[200px]">
              {Array.from({ length: Math.ceil(((results || []).length) / 25) }).map((_, i) => (
                <button 
                  key={i}
                  onClick={() => setSearchBatch(i)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all uppercase tracking-wider whitespace-nowrap ${
                    searchBatch === i 
                      ? 'bg-indigo-500 text-black border-indigo-500 shadow-lg shadow-indigo-500/20' 
                      : 'bg-obsidian-800 text-gray-500 border-white/5 hover:text-gray-300'
                  }`}
                >
                  {i * 25 + 1}-{Math.min((i + 1) * 25, (results || []).length)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {(results || []).slice(searchBatch * 25, (searchBatch + 1) * 25).map((anime) => (
              <AnimeCard key={`search-${anime.mal_id}`} anime={anime} onClick={() => onSelectAnime(anime.mal_id)} />
            ))}
          </div>
        </div>
      ) : submittedQuery && (results || []).length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Search size={64} className="mx-auto mb-4 opacity-10" />
          <p>No results found for "{submittedQuery}"</p>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <h2 className="text-lg font-bold text-white mb-4">Top Rated Anime</h2>
            <div className="grid grid-cols-2 gap-4">
              {(popular || []).slice(0, 4).map((anime) => (
                <AnimeCard key={`top-${anime.mal_id}`} anime={anime} onClick={() => onSelectAnime(anime.mal_id)} />
              ))}
            </div>
          </div>

          <div className="mb-10">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Full Library</h2>
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar max-w-[200px]">
                {Array.from({ length: Math.ceil(((popular || []).length) / 25) }).map((_, i) => (
                  <button 
                    key={`batch-${i}`}
                    onClick={() => setCatalogBatch(i)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black border transition-all uppercase tracking-wider whitespace-nowrap ${
                      catalogBatch === i 
                        ? 'bg-indigo-500 text-black border-indigo-500 shadow-lg shadow-indigo-500/20' 
                        : 'bg-obsidian-800 text-gray-500 border-white/5 hover:text-gray-300'
                    }`}
                  >
                    {i * 25 + 1}-{Math.min((i + 1) * 25, (popular || []).length)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {(popular || []).slice(catalogBatch * 25, (catalogBatch + 1) * 25).map((anime) => (
                <AnimeCard key={`lib-${anime.mal_id}`} anime={anime} onClick={() => onSelectAnime(anime.mal_id)} />
              ))}
            </div>
          </div>
        </>
      )}

      {!query && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -z-10 opacity-5">
           <Search size={200} />
        </div>
      )}
      </div>
    </PullToRefresh>
  );
}

interface AnimeCardProps {
  anime: Anime;
  onClick: () => void;
  key?: any;
}

function AnimeCard({ anime, onClick }: AnimeCardProps) {
  const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1541560052-3744e4e98e44?auto=format&fit=crop&q=80&w=800';
  
  const formatDuration = (durationStr: string, type?: string) => {
    if (!durationStr || durationStr === 'Unknown') return null;
    
    const isMovie = type?.toLowerCase().includes('movie') || 
                    type?.toLowerCase().includes('special') || 
                    durationStr.toLowerCase().includes('hr');
    
    const hrMatch = durationStr.match(/(\d+)\s*hr/i);
    const minMatch = durationStr.match(/(\d+)\s*min/i);
    const secMatch = durationStr.match(/(\d+)\s*sec/i);
    
    const h = hrMatch ? parseInt(hrMatch[1]) : 0;
    const m = minMatch ? parseInt(minMatch[1]) : 0;
    const s = secMatch ? parseInt(secMatch[1]) : 0;
    
    if (isMovie) {
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    } else {
      return `${m}m`;
    }
  };

  const duration = formatDuration(anime.duration, anime.type);

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-obsidian-800 rounded-2xl overflow-hidden border border-white/5 group shadow-lg"
    >
      <div className="relative aspect-[2/3]">
        <img
          src={anime.images?.jpg?.large_image_url || FALLBACK_IMAGE}
          alt={anime.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = FALLBACK_IMAGE;
          }}
        />
        <div className="absolute top-3 left-3 bg-indigo-500/90 backdrop-blur-md text-black font-black text-[10px] px-2 py-0.5 rounded shadow-lg flex items-center gap-1">
          <Star size={10} fill="currentColor" />
          {anime.score || 'N/A'}
        </div>
        <div className="absolute bottom-3 left-3 flex flex-col gap-1">
          {anime.episodes && (
            <div className="bg-black/60 backdrop-blur-md text-white text-[9px] font-black px-2 py-0.5 rounded border border-white/10 w-fit uppercase tracking-tighter">
              {anime.episodes} episodes
            </div>
          )}
        </div>
      </div>
      <div className="p-3">
        <h3 className="text-white font-bold text-xs leading-tight group-hover:text-indigo-400 transition-colors uppercase tracking-tight">
          {anime.title_english || anime.title}
        </h3>
        <div className="flex items-center justify-between mt-2">
           <p className="text-gray-500 text-[9px] uppercase font-black tracking-widest">
             {anime.type || 'TV'}
           </p>
           <p className={`text-[8px] uppercase font-black px-1.5 py-0.5 rounded ${
             anime.status === 'Currently Airing' ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'
           }`}>
             {anime.status === 'Currently Airing' ? 'Airing' : 'Completed'}
           </p>
        </div>
      </div>
    </motion.div>
  );
}

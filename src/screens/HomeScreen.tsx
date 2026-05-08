import { Newspaper, Film, Star, Upload, Info, Play, Calendar, User, ChevronRight, ChevronLeft, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { getTrendingAnime, getRecentAnime, getPopularAnime, getAnimeNews } from '../services/animeService';
import { Anime, NewsItem } from '../types';
import { SeasonDisplay } from '../components/SeasonDisplay';
import PullToRefresh from '../components/PullToRefresh';

interface HomeScreenProps {
  onNavigate: (tab: string) => void;
  setSelectedNewsItem: (news: NewsItem) => void;
}

import { onCacheUpdate } from '../services/animeService';

export default function HomeScreen({ onNavigate, setSelectedNewsItem }: HomeScreenProps) {
  const [trending, setTrending] = useState<Anime[]>([]);
  const [recent, setRecent] = useState<Anime[]>([]);
  const [popular, setPopular] = useState<Anime[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const seenIds = new Set<number>();
    const getUniqueVariety = (data: Anime[], ids: Set<number>) => {
      const filtered = data.filter(item => !ids.has(item.mal_id));
      filtered.forEach(item => ids.add(item.mal_id));
      return filtered;
    };

    const loadAll = async (force = false) => {
      try {
        // Parallel fetch for speed
        const [trendingData, recentData, popularData, newsData] = await Promise.all([
          getTrendingAnime(force),
          getRecentAnime(force),
          getPopularAnime(force),
          getAnimeNews('trending', force)
        ]);

        if (trendingData) {
          const reshuffled = [...trendingData].sort(() => Math.random() - 0.5);
          setTrending(reshuffled);
          reshuffled.slice(0, 15).forEach(a => seenIds.add(a.mal_id));
        }

        if (recentData) {
          const filtered = getUniqueVariety(recentData, seenIds);
          setRecent([...filtered].sort(() => Math.random() - 0.5));
        }

        if (popularData) {
          const filtered = getUniqueVariety(popularData, seenIds);
          setPopular([...filtered].sort(() => Math.random() - 0.5).slice(0, 20));
        }

        if (newsData) setNews(newsData.slice(0, 5));
      } catch (e) {
        console.warn("Home screen fetch error:", e);
      }
    };

    loadAll();
    const interval = setInterval(() => loadAll(true), 60 * 60 * 1000);

    // Listen for background cache updates
    const unsubscribe = onCacheUpdate((key, data) => {
      if (key === 'trending_anime') {
        const reshuffled = [...data].sort(() => Math.random() - 0.5);
        setTrending(reshuffled);
      } else if (key === 'recent_anime') {
        setRecent([...data].sort(() => Math.random() - 0.5));
      } else if (key === 'popular_anime') {
        setPopular([...data].sort(() => Math.random() - 0.5));
      } else if (key === 'news_trending') {
        setNews(data.slice(0, 5));
      }
    });

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Auto-swipe logic
  useEffect(() => {
    if (trending.length === 0) {
      setCurrentSlide(0);
      return;
    }
    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        const total = Math.min(trending.length, 6);
        if (total === 0) return 0;
        return (prev + 1) % total;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [trending]);

  const navItems = [
    { id: 'news', title: 'News Hub', icon: Newspaper, desc: 'Latest updates & articles', tab: 'news', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'aniplay', title: 'AniPlay', icon: Play, desc: 'Stream your favorite anime', tab: 'aniplay', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { id: 'anibase', title: 'AniBase', icon: Database, desc: 'Complete anime database', tab: 'anibase', color: 'text-purple-400', bg: 'bg-purple-500/10' },
  ];

  const featuredAnime = (trending || []).slice(0, 6);

  const handleRefresh = async () => {
    const seenIds = new Set<number>();
    const getUniqueVariety = (data: Anime[], ids: Set<number>) => {
      const filtered = data.filter(item => !ids.has(item.mal_id));
      filtered.forEach(item => ids.add(item.mal_id));
      return filtered;
    };

    // Parallel fetch for speed with cache ignore without blocking the UI
    Promise.all([
      getTrendingAnime(true),
      getRecentAnime(true),
      getPopularAnime(true),
      getAnimeNews('trending', true)
    ]).then(([trendingData, recentData, popularData, newsData]) => {
      if (trendingData) {
        setTrending([...trendingData].sort(() => Math.random() - 0.5));
        trendingData.slice(0, 15).forEach(a => seenIds.add(a.mal_id));
      }

      if (recentData) {
        const filtered = getUniqueVariety(recentData, seenIds);
        setRecent([...filtered].sort(() => Math.random() - 0.5));
      }

      if (popularData) {
        const filtered = getUniqueVariety(popularData, seenIds);
        setPopular([...filtered].sort(() => Math.random() - 0.5).slice(0, 20));
      }

      if (newsData) setNews(newsData.slice(0, 5));
    }).catch(e => console.warn("Home screen refresh error:", e));
    
    // Instant feedback delay
    await new Promise(r => setTimeout(r, 400));
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="pb-24">
        {/* Hero Carousel */}
        <div className="relative h-[380px] w-full overflow-hidden bg-obsidian-900">
          <AnimatePresence initial={false} mode="wait">
            {featuredAnime.length > 0 && featuredAnime[currentSlide % featuredAnime.length] ? (
              <motion.div
                key={featuredAnime[currentSlide % featuredAnime.length].mal_id}
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '-100%', opacity: 0 }}
                transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
                className="absolute inset-0"
                onClick={() => onNavigate(`anime-${featuredAnime[currentSlide % featuredAnime.length].mal_id}`)}
              >
                {/* Background Backdrop */}
                <div 
                  className="absolute inset-0 bg-cover bg-center transition-transform duration-[4000ms] scale-105"
                  style={{ backgroundImage: `url(${featuredAnime[currentSlide % featuredAnime.length].images?.jpg?.large_image_url})` }}
                />
                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-obsidian-900 via-obsidian-900/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-obsidian-900 via-transparent to-transparent opacity-80" />
                
                <div className="absolute bottom-28 left-0 right-0 z-10 flex flex-col items-center text-center px-6">
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className="flex flex-col items-center"
                  >
                    <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-[0.2em] rounded-full border border-indigo-500/30 mb-4 inline-block backdrop-blur-md">
                      Trending Now
                    </span>
                    <h1 className="text-3xl md:text-5xl font-black text-white leading-tight mb-3 tracking-tighter max-w-[320px]">
                      {featuredAnime[currentSlide % featuredAnime.length].title_english || featuredAnime[currentSlide % featuredAnime.length].title}
                    </h1>
                    <p className="text-gray-300 text-[11px] font-medium max-w-[300px] line-clamp-2 leading-relaxed opacity-80 mb-6">
                      {featuredAnime[currentSlide % featuredAnime.length].synopsis}
                    </p>
                    
                    <button 
                      onClick={(e) => { e.stopPropagation(); onNavigate(`anime-${featuredAnime[currentSlide % featuredAnime.length].mal_id}`); }}
                      className="flex items-center gap-2 px-10 py-3 bg-white text-black rounded-2xl font-black text-[10px] uppercase tracking-widest hover:scale-105 transition-all shadow-[0_10px_30px_rgba(255,255,255,0.15)] active:scale-95"
                    >
                      <Info size={14} />
                      Details
                    </button>
                  </motion.div>
                </div>
              </motion.div>
            ) : (
              <div className="absolute inset-0 bg-obsidian-800 animate-pulse flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            )}
          </AnimatePresence>
  
          {/* Carousel Indicators */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {featuredAnime.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.stopPropagation(); setCurrentSlide(idx); }}
                className={`relative h-1 overflow-hidden rounded-full transition-all duration-500 bg-white/20 ${
                  idx === currentSlide ? 'w-10' : 'w-2'
                }`}
              >
                {idx === currentSlide && (
                  <motion.div
                    key={`progress-${idx}-${currentSlide}`}
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 5, ease: "linear" }}
                    className="absolute inset-0 bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]"
                  />
                )}
              </button>
            ))}
          </div>
  
          {/* Navigation Arrows */}
          {featuredAnime.length > 0 && (
            <div className="absolute inset-x-6 bottom-10 z-30 flex justify-between pointer-events-none">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentSlide(prev => {
                    const total = featuredAnime.length;
                    return (prev - 1 + total) % total;
                  });
                }}
                className="w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all pointer-events-auto group/nav active:scale-90 shadow-xl"
              >
                <ChevronLeft size={24} className="group-hover/nav:-translate-x-0.5 transition-transform" />
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentSlide(prev => {
                    const total = featuredAnime.length;
                    return (prev + 1) % total;
                  });
                }}
                className="w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white hover:bg-white hover:text-black transition-all pointer-events-auto group/nav active:scale-90 shadow-xl"
              >
                <ChevronRight size={24} className="group-hover/nav:translate-x-0.5 transition-transform" />
              </button>
            </div>
          )}
        </div>
  
        <div className="px-6">
          {/* Top 5 Latest News Section */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <h3 className="text-white text-[11px] font-black uppercase tracking-[0.2em]">Top 5 Latest News</h3>
              </div>
              <button 
                onClick={() => onNavigate('news')}
                className="text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
              >
                See All
              </button>
            </div>
            <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-6 px-6 pb-2">
              {news.length > 0 ? (
                news.slice(0, 5).map((item, idx) => (
                  <motion.div
                    key={`top-news-${idx}`}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => setSelectedNewsItem(item)}
                    className="shrink-0 w-[280px] bg-obsidian-800/50 backdrop-blur-md rounded-2xl p-3 border border-white/5 flex gap-3 group active:bg-white/5 transition-all cursor-pointer"
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-obsidian-900 shrink-0 border border-white/5">
                      <img 
                        src={item.images?.jpg?.image_url || 'https://images.unsplash.com/photo-1541560052-3744e4e98e44?auto=format&fit=crop&q=80&w=200'} 
                        alt="" 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <div className="flex-1 flex flex-col justify-center min-w-0">
                      <h4 className="text-white text-[11px] font-bold line-clamp-2 leading-snug group-hover:text-indigo-300 transition-colors">
                        {item.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[9px] text-gray-500 font-black uppercase tracking-tighter truncate max-w-[120px]">
                          {item.author_name}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                [1, 2, 3].map(i => (
                  <div key={i} className="shrink-0 w-[280px] h-20 bg-white/5 rounded-2xl animate-pulse" />
                ))
              )}
            </div>
          </div>
  
          <div className="py-8">
            <header className="flex items-center gap-3 mb-8">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
                 <Star size={18} fill="currentColor" />
              </div>
              <h2 className="text-xl font-black tracking-tight text-white uppercase italic">Anime <span className="text-purple-500">Intel Hub</span></h2>
            </header>
  
            <div className="flex flex-col gap-4">
              {navItems.map((item) => (
                <motion.button
                  key={item.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onNavigate(item.tab)}
                  className="group flex items-center gap-4 p-5 rounded-2xl bg-obsidian-800 border border-white/5 relative overflow-hidden active:bg-white/[0.02] transition-colors"
                >
                  <div className="absolute inset-0 border border-transparent group-hover:border-indigo-500 transition-colors rounded-2xl" />
                  <div className={`w-12 h-12 flex items-center justify-center rounded-xl ${item.bg} ${item.color} shrink-0`}>
                    <item.icon size={24} />
                  </div>
                  <div className="text-left flex-1">
                    <h4 className="text-lg font-bold text-white group-hover:text-indigo-400 transition-colors">{item.title}</h4>
                    <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest leading-none mt-1">{item.desc}</p>
                  </div>
                </motion.button>
              ))}
            </div>
  
            {/* Trending Section */}
            <div className="mt-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-white font-bold text-lg tracking-tight">Current Trending</h3>
                <button
                  onClick={() => onNavigate('anibase')}
                  className="text-indigo-400 text-xs font-bold"
                >
                  View All
                </button>
              </div>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
                {trending.length > 0 ? (
                  trending.map((anime) => (
                    <motion.div
                      key={anime.mal_id}
                      whileHover={{ y: -5 }}
                      className="shrink-0 w-36 cursor-pointer"
                      onClick={() => onNavigate(`anime-${anime.mal_id}`)}
                    >
                      <div className="relative aspect-[3/4] bg-obsidian-800 rounded-xl overflow-hidden mb-2">
                        <img
                          src={anime.images?.jpg?.large_image_url || undefined}
                          alt={anime.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541560052-3744e4e98e44?auto=format&fit=crop&q=80&w=800'}
                        />
                        <div className="absolute top-2 right-2 bg-obsidian-800/90 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1 shadow-lg border border-white/10">
                          <Star size={10} className="fill-indigo-400 text-indigo-400" />
                          {anime.score}
                        </div>
                      </div>
                      <h5 className="text-white font-bold text-[11px] line-clamp-1">{anime.title_english || anime.title}</h5>
                      <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">
                        {anime.episodes ? `${anime.episodes} ${anime.episodes === 1 ? 'Episode' : 'Episodes'}` : anime.status === 'Currently Airing' ? 'Airing' : '? Episodes'} <SeasonDisplay animeId={anime.mal_id} />
                      </p>
                    </motion.div>
                  ))
                ) : (
                  [1, 2, 3, 4].map(i => (
                    <div key={i} className="shrink-0 w-36">
                      <div className="aspect-[3/4] bg-white/5 rounded-xl animate-pulse mb-2" />
                      <div className="h-3 w-3/4 bg-white/5 rounded animate-pulse mb-1" />
                      <div className="h-2 w-1/2 bg-white/5 rounded animate-pulse" />
                    </div>
                  ))
                )}
              </div>
            </div>
  
            {/* Latest Hits Section */}
            <div className="mt-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-white font-bold text-lg tracking-tight">Latest Hits</h3>
                <button
                  onClick={() => onNavigate('anibase')}
                  className="text-indigo-400 text-xs font-bold"
                >
                  View All
                </button>
              </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
              {recent.length > 0 ? (
                recent.map((anime) => (
                  <motion.div
                    key={anime.mal_id}
                    whileHover={{ y: -5 }}
                    className="shrink-0 w-36 cursor-pointer"
                    onClick={() => onNavigate(`anime-${anime.mal_id}`)}
                  >
                    <div className="relative aspect-[3/4] bg-obsidian-800 rounded-xl overflow-hidden mb-2">
                      <img
                        src={anime.images?.jpg?.large_image_url || undefined}
                        alt={anime.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541560052-3744e4e98e44?auto=format&fit=crop&q=80&w=800'}
                      />
                      <div className="absolute top-2 right-2 bg-obsidian-800/90 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1 shadow-lg border border-white/10">
                        <Star size={10} className="fill-indigo-400 text-indigo-400" />
                        {anime.score}
                      </div>
                    </div>
                    <h5 className="text-white font-bold text-[11px] line-clamp-1">{anime.title_english || anime.title}</h5>
                    <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">
                      {anime.type} • {anime.status}
                    </p>
                  </motion.div>
                ))
              ) : (
                [1, 2, 3, 4].map(i => (
                  <div key={i} className="shrink-0 w-36">
                    <div className="aspect-[3/4] bg-white/5 rounded-xl animate-pulse mb-2" />
                    <div className="h-3 w-3/4 bg-white/5 rounded animate-pulse mb-1" />
                    <div className="h-2 w-1/2 bg-white/5 rounded animate-pulse" />
                  </div>
                ))
              )}
            </div>
            </div>
  
            {/* All-Time Hot Section */}
            <div className="mt-10">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-white font-bold text-lg tracking-tight">All-Time Hot</h3>
                <button
                  onClick={() => onNavigate('anibase')}
                  className="text-indigo-400 text-xs font-bold"
                >
                  View More
                </button>
              </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide -mx-6 px-6">
              {popular.length > 0 ? (
                popular.map((anime) => (
                  <motion.div
                    key={anime.mal_id}
                    whileHover={{ y: -5 }}
                    className="shrink-0 w-36 cursor-pointer"
                    onClick={() => onNavigate(`anime-${anime.mal_id}`)}
                  >
                    <div className="relative aspect-[3/4] bg-obsidian-800 rounded-xl overflow-hidden mb-2">
                      <img
                        src={anime.images?.jpg?.large_image_url || undefined}
                        alt={anime.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541560052-3744e4e98e44?auto=format&fit=crop&q=80&w=800'}
                      />
                      <div className="absolute top-2 right-2 bg-obsidian-800/90 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white flex items-center gap-1 shadow-lg border border-white/10">
                        <Star size={10} className="fill-indigo-400 text-indigo-400" />
                        {anime.score}
                      </div>
                    </div>
                    <h5 className="text-white font-bold text-[11px] line-clamp-1">{anime.title_english || anime.title}</h5>
                    <p className="text-gray-500 text-[10px] uppercase font-bold tracking-tighter">
                      {anime.members.toLocaleString()} Fans
                    </p>
                  </motion.div>
                ))
              ) : (
                [1, 2, 3, 4].map(i => (
                  <div key={i} className="shrink-0 w-36">
                    <div className="aspect-[3/4] bg-white/5 rounded-xl animate-pulse mb-2" />
                    <div className="h-3 w-3/4 bg-white/5 rounded animate-pulse mb-1" />
                    <div className="h-2 w-1/2 bg-white/5 rounded animate-pulse" />
                  </div>
                ))
              )}
            </div>
            </div>
          </div>
        </div>
      </div>
    </PullToRefresh>
  );
}

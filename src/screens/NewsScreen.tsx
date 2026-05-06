import { Newspaper, ArrowLeft, Calendar, User, Share2, ExternalLink, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { getAnimeNews, onCacheUpdate } from '../services/animeService';
import { NewsItem } from '../types';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import PullToRefresh from '../components/PullToRefresh';

interface NewsScreenProps {
  selectedNewsItem?: NewsItem | null;
  onClearSelection?: () => void;
}

export default function NewsScreen({ selectedNewsItem, onClearSelection }: NewsScreenProps) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [communityNews, setCommunityNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [activeTab, setActiveTab] = useState<'trending' | 'latest' | 'hot' | 'community'>('trending');

  useEffect(() => {
    // Listen for background cache updates
    const unsubscribe = onCacheUpdate((key, data) => {
      if (key === `news_${activeTab}`) {
        setNews(data);
      }
    });
    return () => unsubscribe();
  }, [activeTab]);

  const tabs = [
    { id: 'trending', label: 'Trending', color: 'indigo' },
    { id: 'latest', label: 'Latest', color: 'emerald' },
    { id: 'hot', label: 'Hot', color: 'orange' },
    { id: 'community', label: 'Community', color: 'pink' },
  ] as const;

  useEffect(() => {
    if (selectedNewsItem) {
      setSelectedNews(selectedNewsItem);
    }
  }, [selectedNewsItem]);

  useEffect(() => {
    const q = query(collection(db, 'news'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          url: '#',
          title: data.title,
          date: data.date,
          author_name: data.author,
          images: { jpg: { image_url: data.imageUrl } },
          excerpt: data.content?.replace(/<[^>]*>/g, '').slice(0, 150) + '...',
          content: data.content
        };
      }) as NewsItem[];
      setCommunityNews(docs);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    // Background pre-fetching for all categories
    const categories: ('trending' | 'latest' | 'hot')[] = ['trending', 'latest', 'hot'];
    categories.forEach(cat => {
      getAnimeNews(cat); // This triggers the cached fetch and populates the background
    });
  }, []);

  useEffect(() => {
    if (activeTab === 'community') {
      setNews(communityNews);
      setLoading(false);
      return;
    }

    const loadData = async (force = false) => {
      // Don't show loading if we already have some data (faster transition)
      if (news.length === 0) setLoading(true);
      setError(null);
      
      try {
        const data = await getAnimeNews(activeTab, force);
        if (data && data.length > 0) {
          setNews(data);
        }
      } catch (err) {
        console.error('Failed to fetch news:', err);
        if (news.length === 0) {
          setError('The news feed is currently unavailable. This might be due to heavy traffic on our anime data source.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeTab]);

  const handleRefresh = async () => {
    if (activeTab === 'community') {
      await new Promise(r => setTimeout(r, 400));
      return;
    }
    
    // Start fetch in background
    getAnimeNews(activeTab, true).then(data => {
      if (data && data.length > 0) {
        setNews(data);
      }
    }).catch(err => console.error('Failed to refresh news:', err));
    
    // Provide instant visual feedback
    await new Promise(r => setTimeout(r, 400));
  };

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab === 'community') {
      setNews(communityNews);
    }
  }, [communityNews, activeTab]);

  const getActiveStyles = (category: string) => {
    switch (category) {
      case 'latest': return { bg: 'bg-emerald-600', text: 'text-emerald-400', glass: 'bg-emerald-500/10' };
      case 'hot': return { bg: 'bg-orange-600', text: 'text-orange-400', glass: 'bg-orange-500/10' };
      case 'community': return { bg: 'bg-pink-600', text: 'text-pink-400', glass: 'bg-pink-500/10' };
      default: return { bg: 'bg-indigo-600', text: 'text-indigo-400', glass: 'bg-indigo-500/10' };
    }
  };

  const handleShare = async () => {
    if (!selectedNews) return;
    
    const shareUrl = selectedNews.url !== '#' ? selectedNews.url : window.location.href;
    const shareData = {
      title: selectedNews.title,
      text: `Check out this anime news: ${selectedNews.title}`,
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.text} \n\n ${shareUrl}`);
        // Visual feedback could be added here, but following the "no alert" rule
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1541560052-3744e4e98e44?auto=format&fit=crop&q=80&w=800';

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="pb-24 px-6 pt-8">
      <header className="space-y-6 mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 flex items-center justify-center rounded ${getActiveStyles(activeTab).glass} ${getActiveStyles(activeTab).text}`}>
              <Newspaper size={18} />
            </div>
            <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Anime News</h1>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400">Live Feed</span>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 bg-obsidian-950/50 backdrop-blur-xl p-1.5 rounded-2xl border border-white/5 shadow-2xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 relative overflow-hidden group ${
                activeTab === tab.id 
                  ? `text-white` 
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className={`absolute inset-0 ${getActiveStyles(tab.id).bg} shadow-[0_0_20px_rgba(0,0,0,0.3)]`}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video bg-white/5 rounded-2xl mb-4" />
              <div className="h-4 bg-white/5 rounded w-3/4 mb-2" />
              <div className="h-4 bg-white/5 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-20 px-6">
          <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-500">
            <Users size={32} />
          </div>
          <h2 className="text-white font-black text-xl uppercase tracking-tighter mb-2">Sync Interrupted</h2>
          <p className="text-gray-500 text-sm max-w-xs mx-auto mb-8 font-medium leading-relaxed">
            {error}
          </p>
          <button 
            onClick={() => setActiveTab(activeTab === 'trending' ? 'latest' : 'trending')}
            className="px-8 py-4 bg-white text-black rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95"
          >
            Switch Protocol
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {news.length > 0 ? (
            news.map((item, index) => (
              <motion.button
                key={index}
                onClick={() => setSelectedNews(item)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group w-full text-left"
              >
                <div className="aspect-video w-full rounded-2xl overflow-hidden mb-4 relative bg-obsidian-800">
                  <img
                    src={item.images?.jpg?.image_url || FALLBACK_IMAGE}
                    alt={item.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute top-4 left-4">
                    <span className={`text-[9px] font-black tracking-[0.2em] text-white uppercase px-3 py-1.5 rounded-lg shadow-lg backdrop-blur-md ${getActiveStyles(activeTab).bg}`}>
                      {activeTab}
                    </span>
                  </div>
                </div>
                <h2 className={`text-lg font-bold text-white mb-2 group-hover:${getActiveStyles(activeTab).text} transition-colors line-clamp-2`}>
                  {item.title}
                </h2>
                <p className="text-gray-500 text-sm line-clamp-2 mb-3">
                  {item.excerpt || 'New update from the anime world...'}
                </p>
                <div className="flex items-center justify-between mt-4">
                  <div className="flex items-center gap-3 text-[10px] text-gray-600 font-medium uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <User size={10} />
                      {item.author_name}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-gray-800" />
                    <span className="flex items-center gap-1.5">
                      <Calendar size={10} />
                      {new Date(item.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={`px-4 py-2 rounded-xl border border-current/20 text-[10px] font-black uppercase tracking-widest transition-all group-hover:bg-current group-hover:text-black ${getActiveStyles(activeTab).text}`}>
                    Read Full Story
                  </div>
                </div>
              </motion.button>
            ))
          ) : (
            <div className="text-center py-20 text-gray-500">
              <Newspaper size={48} className="mx-auto mb-4 opacity-20" />
              <p className="font-bold uppercase tracking-widest text-xs">No {activeTab} news found</p>
            </div>
          )}
        </div>
      )}

      {/* News Reader Modal */}
      <AnimatePresence>
        {selectedNews && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-[#080808]"
          >
            <div className="h-full flex flex-col">
              {/* Sticky Top Nav */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#080808]/80 backdrop-blur-md sticky top-0 z-20">
                <button 
                  onClick={() => {
                    setSelectedNews(null);
                    onClearSelection?.();
                  }}
                  className="flex items-center gap-2 text-white group"
                >
                  <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Back to News</span>
                </button>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={handleShare}
                    className="text-gray-400 hover:text-indigo-400 transition-all hover:scale-110 active:scale-95"
                    title="Share News"
                  >
                    <Share2 size={18} className="drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
                  </button>
                  <a 
                    href={selectedNews.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-gray-400 hover:text-white transition-colors"
                    title="Open original site"
                  >
                    <ExternalLink size={18} />
                  </a>
                </div>
              </div>

              {/* Reader Content */}
              <div className="flex-1 overflow-y-auto bg-black">
                <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
                  {/* Category & Date Header */}
                  <div className="flex flex-col items-center gap-4 text-center">
                    <span className={`text-[10px] font-black tracking-[0.3em] uppercase px-4 py-2 rounded-full border ${getActiveStyles(activeTab).glass} ${getActiveStyles(activeTab).text} border-current/20`}>
                      {activeTab} Pulse
                    </span>
                    <h1 className="text-4xl md:text-6xl font-black text-white leading-[1] tracking-tighter uppercase italic select-none">
                      {selectedNews.title}
                    </h1>
                    <div className="flex items-center gap-4 text-gray-500 text-[10px] font-bold uppercase tracking-widest pt-2">
                       <span className="flex items-center gap-2">
                         <User size={12} className={getActiveStyles(activeTab).text} />
                         {selectedNews.author_name}
                       </span>
                       <span className="w-1 h-1 rounded-full bg-gray-800" />
                       <span className="flex items-center gap-2">
                         <Calendar size={12} className={getActiveStyles(activeTab).text} />
                         {new Date(selectedNews.date).toLocaleDateString(undefined, { 
                            month: 'long', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                       </span>
                    </div>
                  </div>

                  {/* Hero Image */}
                  <div className="aspect-video w-full rounded-[2.5rem] overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] border border-white/10 relative group">
                    <img 
                      src={selectedNews.images?.jpg?.image_url || FALLBACK_IMAGE} 
                      alt={selectedNews.title}
                      className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = FALLBACK_IMAGE;
                      }}
                    />
                    <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-[2.5rem]" />
                  </div>

                  {/* Body Content */}
                  <div className="prose prose-invert max-w-none">
                    {selectedNews.content ? (
                      <div 
                        className="text-lg text-gray-300 leading-relaxed space-y-6 news-content selection:bg-indigo-500/30"
                        dangerouslySetInnerHTML={{ __html: selectedNews.content }}
                      />
                    ) : selectedNews.excerpt ? (
                      <div className="space-y-8">
                        <div className="text-xl text-gray-300 leading-relaxed font-medium">
                          {selectedNews.excerpt}
                        </div>
                      </div>
                    ) : (
                      <div className="text-lg text-gray-300 leading-relaxed space-y-6">
                        <p>
                          Detailed information about this news item is being processed. Our team of anime enthusiasts is working to bring you the most accurate and up-to-date coverage.
                        </p>
                        <p>
                          In the meantime, feel free to explore other trending updates or share this breaking news with your community.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Continue Reading Section */}
                  <div className="pt-12 border-t border-white/5 space-y-8">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-black text-xl uppercase tracking-tighter italic">Continue the News</h3>
                      <div className="h-[2px] flex-1 mx-6 bg-white/5" />
                    </div>
                    
                    {news.indexOf(selectedNews) < news.length - 1 && (
                      <button 
                        onClick={() => {
                          const nextItem = news[news.indexOf(selectedNews) + 1];
                          setSelectedNews(nextItem);
                          document.querySelector('.overflow-y-auto')?.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="w-full group text-left space-y-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="aspect-video w-32 rounded-2xl overflow-hidden bg-white/5 border border-white/10 shrink-0">
                            <img 
                              src={news[news.indexOf(selectedNews) + 1].images?.jpg?.image_url || FALLBACK_IMAGE}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                              alt="Next story"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className={`text-[9px] font-bold uppercase tracking-[0.2em] ${getActiveStyles(activeTab).text}`}>Up Next</span>
                            <h4 className="text-white font-bold text-lg leading-tight line-clamp-2 group-hover:underline underline-offset-4 decoration-indigo-500/50">
                              {news[news.indexOf(selectedNews) + 1].title}
                            </h4>
                          </div>
                        </div>
                        <div className="flex items-center justify-center gap-3 py-4 group-hover:opacity-75 transition-opacity">
                           <span className="text-white font-black text-[10px] uppercase tracking-[0.3em]">Show news full informations</span>
                           <ArrowLeft size={16} className={`rotate-180 ${getActiveStyles(activeTab).text}`} />
                        </div>
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Footer Padding */}
                <div className="h-32" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </PullToRefresh>
  );
}

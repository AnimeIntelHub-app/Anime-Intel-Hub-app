import { ArrowLeft, Star, Clock, Calendar, Film, Layers, PlayCircle, Loader2, Share2, Plus, Heart, Bell, Info, ChevronRight, ExternalLink, Play, X, Settings2, Globe, Sparkles, Bookmark, BookmarkCheck, Database, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState, useRef } from 'react';
import { getAnimeById, getAnimeEpisodes, searchAnime } from '../services/animeService';
import { getAIRecommendations, AIRecommendation, getEpisodeSynopsis } from '../services/aiService';
import { Anime } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, setDoc, deleteDoc, collection } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import PullToRefresh from '../components/PullToRefresh';

interface AnimeDetailsScreenProps {
  animeId: number;
  onBack: () => void;
  onNavigate?: (id: number) => void;
}

type TabType = 'episodes' | 'relations' | 'recommendations';

interface AIRecommendationCardProps {
  key?: any;
  rec: AIRecommendation;
  anime?: Anime;
  sourceAnimeId: number;
  onNavigate?: (id: number) => void;
}

function AIRecommendationCard({ rec, anime, sourceAnimeId, onNavigate }: AIRecommendationCardProps) {
  const [feedback, setFeedback] = useState<'helpful' | 'not-helpful' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!anime) return null;

  const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1541560052-3744e4e98e44?auto=format&fit=crop&q=80&w=800';

  const handleFeedback = async (e: any, type: 'helpful' | 'not-helpful') => {
    e.stopPropagation();
    if (!auth.currentUser) {
      alert("Please login to provide feedback.");
      return;
    }

    setIsSubmitting(true);
    try {
      const feedbackRef = doc(collection(db, 'users', auth.currentUser.uid, 'aiFeedback'));
      await setDoc(feedbackRef, {
        animeId: sourceAnimeId,
        recommendedAnimeId: anime.mal_id,
        recommendedTitle: anime.title_english || anime.title,
        isHelpful: type === 'helpful',
        createdAt: new Date().toISOString()
      });
      setFeedback(type);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}/aiFeedback/new`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group text-left cursor-pointer"
      onClick={() => onNavigate?.(anime.mal_id)}
    >
      <div className="relative aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 group-hover:border-indigo-500/50 transition-all shadow-2xl">
        <img 
          src={anime.images.jpg.large_image_url || FALLBACK_IMAGE} 
          alt={anime.title} 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = FALLBACK_IMAGE;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
        
        <div className="absolute top-3 right-3 bg-indigo-500/90 backdrop-blur-md px-2 py-1 rounded text-[8px] font-black text-white uppercase tracking-widest border border-white/10 flex items-center gap-1">
          <Sparkles size={10} />
          AI Suggested
        </div>

        <div className="absolute bottom-4 left-4 right-4 translate-y-2 group-hover:translate-y-0 transition-transform">
           <div className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mb-1 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center">
             <span>Match Reasoning</span>
             {feedback && (
               <span className="text-green-400">Thanks for feedback!</span>
             )}
           </div>
           <p className="text-white text-[9px] font-medium leading-tight line-clamp-3 opacity-0 group-hover:opacity-100 transition-opacity mb-2">
             {rec.reason}
           </p>
           
           <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
             <button
               onClick={(e) => handleFeedback(e, 'helpful')}
               disabled={isSubmitting || feedback !== null}
               className={`flex-1 py-1 px-2 rounded flex items-center justify-center gap-1 text-[8px] font-bold uppercase tracking-widest border transition-colors ${
                 feedback === 'helpful' ? 'bg-green-500/20 text-green-400 border-green-500/50' :
                 'bg-white/10 text-white border-white/20 hover:bg-white/20'
               }`}
             >
               Helpful
             </button>
             <button
               onClick={(e) => handleFeedback(e, 'not-helpful')}
               disabled={isSubmitting || feedback !== null}
               className={`flex-1 py-1 px-2 rounded flex items-center justify-center gap-1 text-[8px] font-bold uppercase tracking-widest border transition-colors ${
                 feedback === 'not-helpful' ? 'bg-red-500/20 text-red-400 border-red-500/50' :
                 'bg-white/10 text-white border-white/20 hover:bg-white/20'
               }`}
             >
               Not Helpful
             </button>
        </div>
      </div>
      <div className="mt-4 space-y-1">
        <h4 className="text-white font-bold text-sm group-hover:text-indigo-400 transition-colors uppercase tracking-tight">
          {anime.title_english || anime.title}
        </h4>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-yellow-500 text-[10px] font-bold">
            <Star size={10} fill="currentColor" />
            {anime.score || '?'}
          </div>
          <span className="text-gray-500 text-[9px] font-black uppercase tracking-widest">{anime.type || 'TV'}</span>
        </div>
      </div>
      </div>
    </motion.div>
  );
}

interface RelationCardProps {
  key?: any;
  item: any;
  onNavigate?: (id: number) => void;
  metadata: any;
  formatDuration: (d: string, t?: string) => string | null;
}

function RelationCard({ item, onNavigate, metadata, formatDuration }: RelationCardProps) {
  return (
    <button
      onClick={() => onNavigate?.(item.mal_id)}
      className="group text-left space-y-4"
    >
      <div className="aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 group-hover:border-indigo-500/50 transition-all shadow-2xl relative">
        <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center">
          {metadata?.image ? (
            <img 
              src={metadata.image || undefined} 
              alt={item.name}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
              referrerPolicy="no-referrer"
              onError={(e) => (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541560052-3744e4e98e44?auto=format&fit=crop&q=80&w=800'}
            />
          ) : (
            <Layers size={40} className="text-gray-700 group-hover:scale-110 group-hover:text-indigo-900 transition-all duration-700 blur-[1px]" />
          )}
        </div>
        <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10 text-[9px] font-black text-white uppercase tracking-widest shadow-lg">
          {item.label}
        </div>
        <div className="absolute inset-0 bg-indigo-600/20 opacity-0 group-hover:opacity-100 transition-all duration-500" />
      </div>

      <div>
        <h4 className="text-white font-bold text-sm leading-tight group-hover:text-indigo-400 transition-colors uppercase tracking-tight">
          {metadata?.title || item.name}
        </h4>
        <div className="mt-2 text-[9px] font-black uppercase tracking-widest text-indigo-500/60 flex items-center gap-3">
          <span>{item.label.includes('Season') ? 'Season' : item.relation}</span>
          {metadata?.duration && (
            <span className="flex items-center gap-1 text-gray-600">
              <Clock size={10} />
              {formatDuration(metadata.duration, metadata.type)}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

export default function AnimeDetailsScreen({ animeId, onBack, onNavigate }: AnimeDetailsScreenProps) {
  const [anime, setAnime] = useState<any>(null);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [animeLoading, setAnimeLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('episodes');
  const [selectedBatch, setSelectedBatch] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);

  useEffect(() => {
    // modal logic removed - only manual trigger now
  }, []);

  const trailerButtonRef = useRef<HTMLButtonElement>(null);

  const openTrailer = () => {
    setShowTrailer(true);
  };

  const closeTrailer = () => {
    setShowTrailer(false);
    trailerButtonRef.current?.focus();
  };
  const [selectedEpisode, setSelectedEpisode] = useState<number | null>(null);
  const [selectedEpDetails, setSelectedEpDetails] = useState<any>(null);
  const [epDetailsLoading, setEpDetailsLoading] = useState(false);
  const [selectedServer, setSelectedServer] = useState(0);
  const [relationMetadata, setRelationMetadata] = useState<Record<number, { title?: string, duration?: string, type?: string, image?: string }>>({});
  const [aiRecs, setAiRecs] = useState<{rec: AIRecommendation, anime: Anime}[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savingLoading, setSavingLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user && anime) {
      checkIfSaved(user.uid, anime.mal_id);
    } else {
      setIsSaved(false);
    }
  }, [user, anime]);

  const checkIfSaved = async (userId: string | null, malId: number) => {
    try {
      if (userId) {
        const docRef = doc(db, 'users', userId, 'collections', malId.toString());
        const docSnap = await getDoc(docRef);
        setIsSaved(docSnap.exists());
      } else {
        const saved = JSON.parse(localStorage.getItem('saved_anime') || '[]');
        setIsSaved(saved.includes(malId));
      }
    } catch (err) {
      if (userId) {
        handleFirestoreError(err, OperationType.GET, `users/${userId}/collections/${malId}`);
      }
    }
  };

  const toggleCollection = async () => {
    if (!anime) return;
    
    setSavingLoading(true);
    
    if (!user) {
        const saved = JSON.parse(localStorage.getItem('saved_anime') || '[]');
        if (isSaved) {
            const newSaved = saved.filter((id: number) => id !== anime.mal_id);
            localStorage.setItem('saved_anime', JSON.stringify(newSaved));
            setIsSaved(false);
        } else {
            saved.push(anime.mal_id);
            localStorage.setItem('saved_anime', JSON.stringify(saved));
            setIsSaved(true);
        }
        setSavingLoading(false);
        return;
    }
    
    const docRef = doc(db, 'users', user.uid, 'collections', anime.mal_id.toString());
    
    try {
      if (isSaved) {
        await deleteDoc(docRef);
        setIsSaved(false);
      } else {
        await setDoc(docRef, {
          animeId: anime.mal_id,
          title: anime.title_english || anime.title,
          imageUrl: anime.images?.jpg?.large_image_url || 'https://images.unsplash.com/photo-1541560052-3744e4e98e44?auto=format&fit=crop&q=80&w=800',
          addedAt: new Date().toISOString()
        });
        setIsSaved(true);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/collections/${anime.mal_id}`);
    } finally {
      setSavingLoading(false);
    }
  };

  const servers = [
    { name: 'VidLink (Fast)', url: (id: number, ep: number) => `https://vidlink.pro/anime/${id}/${ep}` },
    { name: 'VidSrc (HD)', url: (id: number, ep: number) => `https://vidsrc.to/embed/anime/${id}/${ep}` },
    { name: 'Smashy', url: (id: number, ep: number) => `https://embed.smashystream.com/playere.php?mal_id=${id}&ep=${ep}` },
    { name: 'VidSrc.me', url: (id: number, ep: number) => `https://vidsrc.me/embed/anime?mal=${id}&ep=${ep}` },
  ];

  const handleShare = async () => {
    if (!anime) return;
    const shareData = {
      title: anime.title_english || anime.title,
      text: `Check out ${anime.title_english || anime.title} on AniBase!`,
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.url}`);
        alert('Link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy link:', err);
      }
    }
  };

  const handleEpisodeClick = async (epNum: number) => {
    setSelectedEpisode(epNum);
    setEpDetailsLoading(true);
    
    // Use the already loaded episodes list instead of a non-existent detailed endpoint
    const details = episodes.find((ep: any) => ep.mal_id === epNum);
    
    try {
      // Get synopsis from AI service
      const synopsis = await getEpisodeSynopsis(anime?.title_english || anime?.title || 'Anime', epNum);
      setSelectedEpDetails({
        ...(details || { mal_id: epNum, title: `Episode ${epNum}` }),
        synopsis
      });
    } catch (err) {
      console.error("Error fetching episode details:", err);
      setSelectedEpDetails(details || { mal_id: epNum, title: `Episode ${epNum}` });
    } finally {
      setEpDetailsLoading(false);
    }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    setSelectedBatch(0);
    setRelationMetadata({});
    setAiRecs([]);

    loadData();
  }, [animeId]);

  async function loadData(force = false) {
    setAnimeLoading(true);
    setEpisodesLoading(true);
    
    try {
      const [animeData, episodesData] = await Promise.all([
        getAnimeById(animeId, force),
        getAnimeEpisodes(animeId, force)
      ]);

      setAnime(animeData);
      setEpisodes(episodesData);
      setAnimeLoading(false);
      setEpisodesLoading(false);

      if (animeData) {
        // Background fetch metadata for relations
        const relations = animeData.relations || [];
        const entriesToFetch = relations
          .flatMap((r: any) => r.entry)
          .filter((e: any) => e.type === 'anime')
          .slice(0, 15);

        await Promise.allSettled(entriesToFetch.map(async (entry: any) => {
          try {
            const detailed = await getAnimeById(entry.mal_id, force);
            if (detailed) {
              setRelationMetadata(prev => ({ 
                ...prev, 
                [entry.mal_id]: { 
                  title: detailed.title_english || detailed.title,
                  duration: detailed.duration,
                  type: detailed.type,
                  image: detailed.images.jpg.large_image_url
                } 
              }));
            }
          } catch (err) {
            // Silently ignore
          }
        }));
      }
    } catch (e) {
      console.error("Failed to load anime info:", e);
      setAnimeLoading(false);
      setEpisodesLoading(false);
    }
  }

  const handleRefresh = async () => {
    loadData(true).catch(e => console.error(e));
    if (activeTab === 'recommendations') {
      loadRecommendations().catch(e => console.error(e));
    }
    await new Promise(r => setTimeout(r, 400));
  };

  useEffect(() => {
    if (activeTab === 'recommendations' && anime && aiRecs.length === 0 && !aiLoading) {
      loadRecommendations();
    }
  }, [activeTab, anime]);

  const loadRecommendations = async (loadMore = false) => {
    if (!anime) return;
    setAiLoading(true);
    try {
      const excludeTitles = loadMore ? aiRecs.map(r => r.anime.title_english || r.anime.title) : [];
      const suggestions = await getAIRecommendations(anime, excludeTitles);
      const resolved: {rec: AIRecommendation, anime: Anime}[] = [];
      
      for (const s of suggestions) {
        const results = await searchAnime(s.title);
        if (results && results.length > 0) {
          resolved.push({ rec: s, anime: results[0] });
        }
        // Small delay to respect rate limit
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (loadMore) {
        setAiRecs(prev => [...prev, ...resolved]);
      } else {
        // Shuffle the results for fresh variety every time
        const shuffled = [...resolved].sort(() => Math.random() - 0.5);
        setAiRecs(shuffled);
      }
    } catch (err) {
      console.error("Failed to fetch AI recs:", err);
    }
    setAiLoading(false);
  };

  if (animeLoading && !anime) {
    return (
      <div className="min-h-screen bg-[#080808] relative overflow-x-hidden">
        <div className="max-w-[1400px] mx-auto z-10 px-4 md:px-12 py-8 pt-24">
          <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-12">
            <aside className="space-y-8">
              <div className="aspect-[2/3] w-full rounded-2xl bg-white/5 animate-pulse border border-white/10" />
              <div className="space-y-4">
                <div className="h-3 w-2/3 bg-white/5 animate-pulse rounded-full" />
                <div className="h-10 w-full bg-white/5 animate-pulse rounded-xl" />
                <div className="flex gap-2">
                  <div className="h-6 w-16 bg-white/5 animate-pulse rounded-lg" />
                  <div className="h-6 w-20 bg-white/5 animate-pulse rounded-lg" />
                </div>
              </div>
            </aside>
            <main className="space-y-12">
              <div className="space-y-4">
                <div className="h-4 w-24 bg-white/5 animate-pulse rounded-full" />
                <div className="space-y-2">
                  <div className="h-4 w-full bg-white/5 animate-pulse rounded-full" />
                  <div className="h-4 w-full bg-white/5 animate-pulse rounded-full" />
                  <div className="h-4 w-3/4 bg-white/5 animate-pulse rounded-full" />
                </div>
              </div>
              <div className="h-14 w-full md:w-2/3 bg-white/5 animate-pulse rounded-2xl" />
            </main>
          </div>
        </div>
      </div>
    );
  }

  if (!anime) return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center text-gray-500 font-bold uppercase tracking-widest">
      Anime Not Found
    </div>
  );

  const formatDuration = (durationStr: string, type?: string) => {
    if (!durationStr || durationStr === 'Unknown') return null;
    
    const isMovie = type?.toLowerCase().includes('movie') || 
                    type?.toLowerCase().includes('special') || 
                    durationStr.toLowerCase().includes('hr');
    
    // Extract times using regex
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

  // Categorize relations with enhanced parsing for "Seasons" focus
  const allRelations = (anime.relations || []);
  
  const getSeasonLabel = (name: string, relation: string) => {
    const seasonMatch = name.match(/Season\s+(\d+)/i);
    const partMatch = name.match(/Part\s+(\d+)/i);
    const finalSeasonMatch = name.match(/The Final Season/i);
    
    if (finalSeasonMatch) {
      return `Final Season${partMatch ? ` (Part ${partMatch[1]})` : ''}`;
    }
    
    if (seasonMatch) {
      let label = `Season ${seasonMatch[1]}`;
      if (partMatch) label += ` (Part ${partMatch[1]})`;
      return label;
    }
    
    return relation;
  };

  const categorizedRelations = allRelations.reduce((acc: any, rel: any) => {
    rel.entry.forEach((entry: any) => {
      if (entry.type !== 'anime') return;
      
      const malId = entry.mal_id;
      // Prevent duplicates across categories by tracking what we've seen
      if (acc.seenIds.has(malId)) return;
      acc.seenIds.add(malId);

      const metadata = relationMetadata[malId] || {};
      const type = metadata.type?.toLowerCase() || '';
      const name = metadata.title || entry.name;
      const relation = rel.relation;
      
      const item = { 
        ...entry, 
        relation, 
        label: getSeasonLabel(name, relation),
        type: metadata.type,
        name: name
      };

      const isMainSeason = name.toLowerCase().includes('season') || 
                          relation.toLowerCase().includes('sequel') || 
                          relation.toLowerCase().includes('prequel') ||
                          relation.toLowerCase().includes('parent story');

      if (type.includes('movie')) {
        acc.movies.push(item);
      } else if (isMainSeason && !type.includes('special') && !type.includes('ova')) {
        acc.seasons.push(item);
      } else {
        acc.others.push(item);
      }
    });
    return acc;
  }, { seasons: [], movies: [], others: [], seenIds: new Set() });

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-[#080808] relative overflow-x-hidden">
      {/* Background Backdrop */}
      <div className="fixed inset-0 z-0">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 blur-[100px] transform scale-110" 
          style={{ backgroundImage: anime.images?.jpg?.large_image_url ? `url(${anime.images.jpg.large_image_url})` : 'none' }} 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#080808]/80 to-[#080808]" />
      </div>

      <div className="max-w-[1400px] mx-auto relative z-10 px-4 md:px-12 py-8 pt-16 md:pt-24">
        {/* Navigation */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors group">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10">
              <ArrowLeft size={18} />
            </div>
            <span className="hidden md:block font-bold text-xs uppercase tracking-[0.2em]">Go Back</span>
          </button>
          
          <div className="flex items-center gap-2">
             <button
               onClick={toggleCollection}
               disabled={savingLoading}
               className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-[10px] font-black uppercase tracking-widest transition-all border ${
                 isSaved ? 'bg-indigo-500/20 hover:bg-indigo-500/30 border-indigo-500/50 text-indigo-300' : 'bg-white/5 hover:bg-white/10 border-white/10'
               }`}
             >
               {savingLoading ? <Loader2 size={14} className="animate-spin" /> : isSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
               {isSaved ? 'Saved' : 'Save'}
             </button>
             <button onClick={handleShare} className="flex items-center gap-2 px-5 py-2.5 bg-white/5 hover:bg-white/10 rounded-full text-white text-[10px] font-black uppercase tracking-widest transition-all border border-white/10">
               <Share2 size={14} />
               Share
             </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-12">
          {/* LEFT SIDEBAR */}
          <aside className="space-y-8">
            <div className="space-y-6">
              <div className="relative rounded-2xl overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] border border-white/5 group">
                <img 
                  src={anime.images?.jpg?.large_image_url || 'https://images.unsplash.com/photo-1541560052-3744e4e98e44?auto=format&fit=crop&q=80&w=800'} 
                  alt={anime.title} 
                  className="w-full aspect-[2/3] object-cover" 
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1541560052-3744e4e98e44?auto=format&fit=crop&q=80&w=800';
                  }}
                />
              </div>

              {/* Title & Genres moved here */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest line-clamp-1">{anime.title}</div>
                  <h1 className="text-3xl font-black text-white tracking-tighter uppercase leading-tight">
                    {anime.title_english || anime.title}
                  </h1>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(anime.genres || []).map((g: any, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest text-gray-400">
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  ref={trailerButtonRef}
                  onClick={() => (anime.trailer?.embed_url || anime.trailer?.youtube_id) ? openTrailer() : anime.trailer?.url && window.open(anime.trailer.url, '_blank')}
                  className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center gap-3 text-white transition-all border border-white/10 group"
                >
                  <PlayCircle size={18} className={`transition-transform ${(anime.trailer?.embed_url || anime.trailer?.youtube_id) ? 'text-indigo-400 group-hover:scale-110' : 'text-gray-500'}`} />
                  <span className="text-[11px] font-black uppercase tracking-[0.2em]">{(anime.trailer?.embed_url || anime.trailer?.youtube_id) ? 'Watch Trailer' : 'Trailer Not Available'}</span>
                </button>
                {anime.trailer?.url && (
                  <button 
                    onClick={() => window.open(anime.trailer.url, '_blank')}
                    className="w-14 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-all border border-white/10"
                    title="Open in new tab"
                  >
                    <ExternalLink size={18} />
                  </button>
                )}
              </div>

              {/* Action Buttons moved here */}

              {/* Score & Rank */}
              <div className="flex flex-col gap-6 pt-4 border-t border-white/10">
                <div className="flex items-center gap-4 group">
                  <div className="w-14 h-14 rounded-2xl bg-yellow-500/10 flex items-center justify-center text-yellow-500 group-hover:bg-yellow-500/20 transition-colors border border-yellow-500/20">
                    <Star size={28} fill="currentColor" />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white leading-none">{anime.score}</span>
                      <span className="text-[10px] font-bold text-gray-500">/ 10</span>
                    </div>
                    <div className="text-[9px] uppercase font-bold text-gray-500 mt-1.5 tracking-widest leading-none">
                      {anime.scored_by?.toLocaleString()} Average
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 group">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500/20 transition-colors border border-indigo-500/20">
                    <Star size={28} fill="currentColor" />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-white leading-none">{((anime.score || 0) * 0.98).toFixed(2)}</span>
                    </div>
                    <div className="text-[9px] uppercase font-bold text-gray-500 mt-1.5 tracking-widest leading-none">
                      Weighted Rank #{anime.rank}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Properties */}
            <div className="space-y-6 pt-4 border-t border-white/10">
              {[
                { label: 'Type', value: anime.type },
                { label: 'Status', value: anime.status },
                { label: 'Release', value: `${anime.aired?.string?.split(' to ')[0] || anime.year || 'Unknown'}` },
                { label: 'Episodes', value: anime.episodes ? `${anime.episodes} total` : anime.status === 'Currently Airing' ? 'Airing' : 'Unknown' },
                { label: 'Rating', value: anime.rating || 'G' },
              ].map((prop, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-[9px] uppercase font-black tracking-widest text-gray-500">{prop.label}</div>
                  <div className="text-white font-bold text-sm">{prop.value}</div>
                </div>
              ))}

              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="text-[9px] uppercase font-black tracking-widest text-gray-500">Themes</div>
                <div className="flex flex-wrap gap-2">
                  {(anime.themes || []).map((t: any) => (
                    <span key={t.name} className="px-3 py-1 bg-white/5 rounded-full text-[10px] text-gray-300 border border-white/5 font-bold">{t.name}</span>
                  ))}
                  {(!anime.themes || anime.themes.length === 0) && <span className="text-gray-600 text-[10px]">None</span>}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="text-[9px] uppercase font-black tracking-widest text-gray-500">Demographics</div>
                <div className="flex flex-wrap gap-2">
                   {(anime.demographics || []).map((d: any) => (
                    <span key={d.name} className="px-3 py-1 bg-white/5 rounded-full text-[10px] text-gray-300 border border-white/5 font-bold">{d.name}</span>
                  ))}
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="text-[9px] uppercase font-black tracking-widest text-gray-500">Studios</div>
                <div className="flex flex-wrap gap-2">
                   {(anime.studios || []).map((s: any) => (
                    <span key={s.name} className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] border border-indigo-500/20 font-bold">{s.name}</span>
                  ))}
                </div>
              </div>
              
              <div className="space-y-2 pt-4 border-t border-white/10">
                <div className="text-[9px] uppercase font-black tracking-widest text-gray-500">Producers</div>
                <div className="flex flex-wrap gap-1.5">
                   {(anime.producers || []).slice(0, 5).map((p: any) => (
                    <span key={p.name} className="text-[10px] text-gray-400 font-bold hover:text-white transition-colors cursor-default whitespace-nowrap">{p.name},</span>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          {/* MAIN CONTENT */}
          <main className="space-y-12 pt-4 pb-24">
            {/* Synopsis */}
            <div className="space-y-4">
              <div className="text-[10px] uppercase font-black tracking-widest text-gray-500">Synopsis</div>
              <div className="relative group">
                <p className={`text-gray-400 leading-relaxed text-sm max-w-4xl transition-all duration-500 ${showFullSynopsis ? 'line-clamp-none' : 'line-clamp-4'}`}>
                  {anime.synopsis}
                </p>
                <button
                  onClick={() => setShowFullSynopsis(!showFullSynopsis)}
                  className="mt-4 flex items-center gap-2 text-indigo-400 text-[10px] font-black uppercase tracking-widest hover:text-white transition-colors"
                >
                  {showFullSynopsis ? 'Read Less' : 'Read More'} <ChevronRight size={14} className={showFullSynopsis ? 'rotate-90' : ''} />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="space-y-8">
              <div className="flex items-center gap-1 p-1 bg-white/5 rounded-2xl border border-white/10 w-fit">
                {[
                  { id: 'episodes', label: 'Episodes', count: episodes.length },
                  { id: 'relations', label: 'Relations', count: (categorizedRelations.seasons.length + categorizedRelations.movies.length + categorizedRelations.others.length) },
                  { id: 'recommendations', label: 'Recommendations', count: aiRecs.length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={`px-8 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${
                      activeTab === tab.id 
                        ? 'bg-white/10 text-white shadow-xl' 
                        : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-black border ${
                        activeTab === tab.id ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-white/5 text-gray-500 border-white/10'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                >
                   {activeTab === 'episodes' && (
                    <div className="space-y-6">
                      {episodesLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[1,2,3,4,5,6].map(i => (
                            <div key={i} className="flex items-center gap-6 p-4 bg-white/5 rounded-2xl border border-white/10 animate-pulse">
                              <div className="w-10 h-10 rounded-xl bg-white/5 shrink-0" />
                              <div className="flex-1 space-y-2">
                                <div className="h-4 w-2/3 bg-white/5 rounded-full" />
                                <div className="h-3 w-1/4 bg-white/5 rounded-full" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          {episodes.length > 25 && (
                            <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                              {Array.from({ length: Math.ceil(episodes.length / 25) }).map((_, i) => (
                                <button
                                  key={i}
                                  onClick={() => setSelectedBatch(i)}
                                  className={`px-6 py-3 rounded-xl text-[10px] font-black whitespace-nowrap transition-all border uppercase tracking-widest flex items-center gap-3 ${
                                    selectedBatch === i
                                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)]'
                                      : 'bg-white/5 text-gray-500 border-white/10 hover:border-white/20'
                                  }`}
                                >
                                  <span>{i * 25 + 1}-{Math.min((i + 1) * 25, episodes.length)}</span>
                                  <span className={`px-2 py-0.5 rounded-md text-[8px] font-black border ${
                                    selectedBatch === i ? 'bg-white/20 border-white/20' : 'bg-white/5 border-white/10 text-gray-600'
                                  }`}>
                                    {Math.min((i + 1) * 25, episodes.length) - (i * 25)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {episodes.length > 0 ? (
                              episodes.slice(selectedBatch * 25, (selectedBatch + 1) * 25).map((ep: any) => (
                                <button 
                                  key={ep.mal_id} 
                                  onClick={() => handleEpisodeClick(ep.mal_id)}
                                  className="flex items-center gap-6 p-4 bg-white/5 rounded-2xl border border-white/10 hover:border-indigo-500/50 transition-all group text-left w-full hover:bg-white/10"
                                >
                                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-black text-[10px] shrink-0 shadow-inner group-hover:bg-indigo-500/20 transition-all uppercase">
                                    EP {ep.mal_id}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h4 className="text-white font-bold text-sm group-hover:text-indigo-400 transition-colors uppercase tracking-tight">{ep.title}</h4>
                                    <div className="flex items-center gap-1.5 mt-1 text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                                      <Clock size={10} />
                                      {formatDuration(ep.duration || anime.duration, anime.type) || '24m'}
                                    </div>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="col-span-2 py-20 text-center bg-white/5 rounded-3xl border-2 border-dashed border-white/10">
                                <div className="text-gray-500 font-bold uppercase tracking-[0.2em]">Episode List Unavailable</div>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {activeTab === 'relations' && (
                    <div className="space-y-12">
                      {/* Seasons Section */}
                      {categorizedRelations.seasons.length > 0 && (
                        <div className="space-y-6">
                          <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-white/10" />
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500/80 bg-indigo-500/5 px-4 py-1.5 rounded-full border border-indigo-500/10">Main Series / Seasons</div>
                            <div className="h-px flex-1 bg-white/10" />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                            {categorizedRelations.seasons.map((s: any) => (
                              <RelationCard key={s.mal_id} item={s} onNavigate={onNavigate} metadata={relationMetadata[s.mal_id]} formatDuration={formatDuration} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Movies Section */}
                      {categorizedRelations.movies.length > 0 && (
                        <div className="space-y-6">
                          <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-white/10" />
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/80 bg-amber-500/5 px-4 py-1.5 rounded-full border border-amber-500/10">Movies & Cinema</div>
                            <div className="h-px flex-1 bg-white/10" />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                            {categorizedRelations.movies.map((s: any) => (
                              <RelationCard key={s.mal_id} item={s} onNavigate={onNavigate} metadata={relationMetadata[s.mal_id]} formatDuration={formatDuration} />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Others Section */}
                      {categorizedRelations.others.length > 0 && (
                        <div className="space-y-6">
                          <div className="flex items-center gap-4">
                            <div className="h-px flex-1 bg-white/10" />
                            <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500/80 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">Specials & Others</div>
                            <div className="h-px flex-1 bg-white/10" />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                            {categorizedRelations.others.map((s: any) => (
                              <RelationCard key={s.mal_id} item={s} onNavigate={onNavigate} metadata={relationMetadata[s.mal_id]} formatDuration={formatDuration} />
                            ))}
                          </div>
                        </div>
                      )}

                      {categorizedRelations.seasons.length === 0 && categorizedRelations.movies.length === 0 && categorizedRelations.others.length === 0 && (
                        <div className="py-20 text-center bg-white/5 rounded-3xl border-2 border-dashed border-white/10">
                          <div className="text-gray-500 font-bold uppercase tracking-[0.2em]">No Relations Found</div>
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'recommendations' && (
                    <div className="space-y-10">
                      <div className="flex items-center justify-between">
                         <div className="space-y-1">
                            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-3">
                              <Sparkles size={20} className="text-indigo-400" />
                              AI Neural Recommendations
                            </h2>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                              Curated based on genres, themes and narrative complexity
                            </p>
                         </div>
                      </div>

                      {aiLoading ? (
                        <div className="py-24 text-center bg-white/5 rounded-3xl border border-white/10 flex flex-col items-center justify-center gap-4">
                           <motion.div
                             animate={{ rotate: 360 }}
                             transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                             className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full"
                           />
                           <div className="space-y-1">
                              <div className="text-gray-400 font-bold uppercase tracking-widest text-xs">Architecting Selections</div>
                              <div className="text-[9px] text-gray-600 uppercase tracking-[0.3em]">Analyzing narrative patterns...</div>
                           </div>
                        </div>
                      ) : aiRecs.length > 0 ? (
                        <div className="space-y-8">
                          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-x-6 gap-y-10">
                            {aiRecs.map((item, i) => (
                              <AIRecommendationCard 
                                key={i} 
                                rec={item.rec} 
                                anime={item.anime} 
                                sourceAnimeId={anime.mal_id}
                                onNavigate={onNavigate} 
                              />
                            ))}
                          </div>
                          <div className="flex justify-center mt-8">
                            <button
                              onClick={() => loadRecommendations(true)}
                              className="px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-white text-xs font-bold uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(255,255,255,0.05)] hover:shadow-[0_0_30px_rgba(255,255,255,0.1)] flex items-center gap-2"
                            >
                              <Sparkles size={16} />
                              Load More AI Matches
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="py-24 text-center bg-white/5 rounded-3xl border border-white/10">
                          <Sparkles size={32} className="text-gray-700 mx-auto mb-4" />
                          <div className="text-gray-500 font-bold uppercase tracking-widest mb-1">No AI Matches Found</div>
                          <div className="text-[9px] text-gray-600 uppercase tracking-[0.3em]">Try exploring related titles in the relations tab</div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
      
      {/* Trailer Modal */}
      <AnimatePresence>
        {showTrailer && (anime.trailer?.embed_url || anime.trailer?.youtube_id) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12"
          >
            <div className="absolute inset-0 bg-[#080808]/95 backdrop-blur-xl" onClick={closeTrailer} />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-5xl aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 shadow-[0_64px_128px_-16px_rgba(0,0,0,1)]"
            >
              <div className="absolute top-0 left-0 right-0 p-6 z-20 flex justify-between items-center pointer-events-none">
                <div />
                <button 
                  onClick={closeTrailer}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md transition-all border border-white/10 group pointer-events-auto shadow-xl"
                  title="Close Trailer"
                >
                  <X size={20} />
                </button>
              </div>
              <iframe
                src={anime.trailer?.embed_url ? (() => {
                  try {
                    const url = new URL(anime.trailer.embed_url);
                    url.searchParams.set('autoplay', '1');
                    return url.toString();
                  } catch (e) {
                    return anime.trailer.embed_url.includes('?') ? `${anime.trailer.embed_url}&autoplay=1` : `${anime.trailer.embed_url}?autoplay=1`;
                  }
                })() : `https://www.youtube.com/embed/${anime.trailer.youtube_id}?autoplay=1`}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Anime Trailer"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Episode Details Modal */}
      <AnimatePresence>
        {selectedEpisode !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8"
          >
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
              onClick={() => setSelectedEpisode(null)}
            />
            
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-[#0a0a0a] rounded-3xl overflow-hidden border border-white/10 shadow-[0_64px_128px_-16px_rgba(0,0,0,1)] flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="p-6 md:p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-black text-xs border border-indigo-500/20 shadow-inner">
                    EP {selectedEpisode}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Episode Details</div>
                    <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">
                      {epDetailsLoading ? 'Loading Intelligence...' : selectedEpDetails?.title || `Episode ${selectedEpisode}`}
                    </h2>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedEpisode(null)}
                  className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-all border border-white/10 group shadow-lg"
                >
                  <X size={18} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-8 space-y-8">
                {epDetailsLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <Loader2 size={32} className="text-indigo-500 animate-spin" />
                    <div className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Retrieving Metadata...</div>
                  </div>
                ) : selectedEpDetails ? (
                  <>
                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1 group hover:border-indigo-500/30 transition-colors">
                        <div className="flex items-center gap-2 text-yellow-500 text-[10px] font-black uppercase tracking-widest mb-1">
                          <Star size={10} fill="currentColor" /> Rating
                        </div>
                        <div className="text-white font-black text-lg">{anime.score || 'N/A'}</div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1 group hover:border-indigo-500/30 transition-colors">
                        <div className="flex items-center gap-2 text-indigo-400 text-[10px] font-black uppercase tracking-widest mb-1">
                          <Calendar size={10} /> Aired
                        </div>
                        <div className="text-white font-black text-lg">
                          {selectedEpDetails.aired ? new Date(selectedEpDetails.aired).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}
                        </div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1 group hover:border-indigo-500/30 transition-colors">
                        <div className="flex items-center gap-2 text-rose-400 text-[10px] font-black uppercase tracking-widest mb-1">
                          <Clock size={10} /> Length
                        </div>
                        <div className="text-white font-black text-lg">{anime.duration || '24m'}</div>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-1 group hover:border-indigo-500/30 transition-colors">
                        <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-widest mb-1">
                          <Award size={10} /> Filler
                        </div>
                        <div className={`text-lg font-black ${selectedEpDetails.filler ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {selectedEpDetails.filler ? 'YES' : 'NO'}
                        </div>
                      </div>
                    </div>

                    {/* Synopsis */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/5" />
                        <div className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Neural Synopsis</div>
                        <div className="h-px flex-1 bg-white/5" />
                      </div>
                      <div className="bg-white/[0.02] p-6 rounded-3xl border border-white/5">
                        <p className="text-gray-300 leading-relaxed text-sm">
                          {selectedEpDetails.synopsis || "No detailed synopsis available for this episode. Stay tuned for database updates."}
                        </p>
                      </div>
                    </div>

                    {/* Footer Extra Info */}
                    <div className="flex flex-wrap gap-4 pt-4">
                       <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-white/5 px-4 py-2 rounded-xl border border-white/10">
                          <Globe size={12} /> {selectedEpDetails.title_japanese || 'N/A'}
                       </div>
                       {selectedEpDetails.recap && (
                         <div className="flex items-center gap-2 text-[10px] font-bold text-amber-500 uppercase tracking-widest bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20">
                            <Layers size={12} /> Recap Episode
                         </div>
                       )}
                    </div>
                  </>
                ) : (
                  <div className="py-20 text-center space-y-4">
                    <div className="text-gray-500 font-bold uppercase tracking-[0.2em] text-sm">No Intel Found</div>
                    <p className="text-xs text-gray-600 max-w-xs mx-auto">The requested data could not be retrieved from the central database.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Episode Player Modal removed as per user request */}
      </div>
    </PullToRefresh>
  );
}

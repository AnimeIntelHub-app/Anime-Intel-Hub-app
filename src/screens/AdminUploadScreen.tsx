import { Lock, Upload, ArrowLeft, CheckCircle2, AlertCircle, Trash2, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState } from 'react';
import ReactQuill from 'react-quill-new';
import { db } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';

interface AdminUploadScreenProps {
  onBack: () => void;
}

export default function AdminUploadScreen({ onBack }: AdminUploadScreenProps) {
  const [password, setPassword] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [contentType, setContentType] = useState<'news' | 'aniplay'>('news');
  const [title, setTitle] = useState('');
  const [thumbnail, setThumbnail] = useState('');
  const [newsContent, setNewsContent] = useState('');
  const [newsDate, setNewsDate] = useState(new Date().toISOString().split('T')[0]);
  const [videoUrl, setVideoUrl] = useState('');
  const [category, setCategory] = useState<string>('Videos');
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Lists state
  const [news, setNews] = useState<any[]>([]);
  const [aniplay, setAniplay] = useState<any[]>([]);

  useState(() => {
    const qNews = query(collection(db, 'news'), orderBy('date', 'desc'));
    const unsubNews = onSnapshot(qNews, (snapshot) => {
      setNews(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const qAniplay = query(collection(db, 'aniplay'), orderBy('createdAt', 'desc'));
    const unsubAniplay = onSnapshot(qAniplay, (snapshot) => {
      setAniplay(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubNews();
      unsubAniplay();
    };
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'jshdgegdew8723648u7634uhud8%#%$*&') { 
      setIsAuthorized(true);
      setError('');
    } else {
      setError('Incorrect Password');
      setPassword('');
    }
  };

  const handleUpload = async () => {
    setIsUploading(true);
    setUploadStatus('idle');
    setError('');

    try {
      if (contentType === 'news') {
        if (!title) throw new Error("Title is required for News Article");
        if (!thumbnail) throw new Error("Featured Image URL is required for News Article");
        if (!newsContent || newsContent === '<p><br></p>') throw new Error("Article content is required");
        
        await addDoc(collection(db, 'news'), {
          title,
          content: newsContent, 
          imageUrl: thumbnail,
          author: 'Admin',
          date: new Date(newsDate).toISOString()
        });
      } else {
        if (!title) throw new Error("Title is required for AniPlay");
        if (!videoUrl) throw new Error("Video URL (MEGA) is required for AniPlay");
        
        await addDoc(collection(db, 'aniplay'), {
          title,
          url: videoUrl,
          category,
          thumbnail: thumbnail || '',
          createdAt: new Date().toISOString()
        });
      }
      
      setUploadStatus('success');
      setTitle('');
      setThumbnail('');
      setNewsContent('');
      setNewsDate(new Date().toISOString().split('T')[0]);
      setVideoUrl('');
      
      setTimeout(() => setUploadStatus('idle'), 3000);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadStatus('error');
      setError(err instanceof Error ? err.message : 'Upload failed. Check permissions.');
    } finally {
      setIsUploading(false);
    }
  };

  const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1541560052-3744e4e98e44?auto=format&fit=crop&q=80&w=800';

  const handleDelete = async (coll: string, id: string) => {
    setDeletingId(id);
    setError('');
    try {
      await deleteDoc(doc(db, coll, id));
    } catch (err) {
      console.error("Delete error:", err);
      setError("Delete failed: " + (err instanceof Error ? err.message : 'Permission denied'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-black pb-24 flex flex-col">
       <header className="p-4 px-6 flex items-center justify-between border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-90">
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-xl font-bold text-white tracking-tight">Admin Hub</h1>
          </div>
       </header>

       <AnimatePresence mode="wait">
          {!isAuthorized ? (
            <motion.div key="auth" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="flex-1 flex flex-col items-center justify-center px-6 min-h-[70vh]">
              <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-6 shadow-xl border border-indigo-500/20">
                <Lock size={32} />
              </div>
              <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Access Portal</h2>
              <p className="text-gray-500 text-sm mb-10 text-center">Enter administrator password</p>
              <form onSubmit={handlePasswordSubmit} className="w-full max-w-xs space-y-4">
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password..." className="w-full bg-obsidian-800 border border-white/10 rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all text-center" />
                  {error && <p className="text-red-500 text-xs font-bold text-center">{error}</p>}
                  <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-black text-sm hover:bg-indigo-700 active:scale-95 transition-all">Authorize</button>
              </form>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="px-6 flex flex-col gap-6 pt-6 pb-12">
               <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 flex justify-between items-center shadow-lg">
                  <div className="flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-full border border-indigo-500/30 flex items-center justify-center bg-indigo-500/10 text-indigo-400"><Lock size={16}/></div>
                    <div>
                      <h3 className="text-white font-bold text-sm">Authorized</h3>
                      <p className="text-indigo-400/60 text-[10px] uppercase font-bold tracking-widest">Admin Access Granted</p>
                    </div>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
               </div>

               <div className="space-y-4 pb-12">
                 <h3 className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.2em] px-1">Deploy New Content</h3>
                 <div className="bg-obsidian-800 rounded-2xl p-6 border border-white/5 space-y-6 shadow-xl">
                    <div className="space-y-2">
                       <label className="text-gray-500 text-[10px] uppercase font-black tracking-widest leading-none px-1">Structure</label>
                       <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => setContentType('news')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${contentType === 'news' ? 'bg-indigo-500 text-black shadow-lg shadow-indigo-500/20' : 'bg-obsidian-900 text-gray-500 border border-white/10 hover:border-indigo-500/30'}`}>Anime News Article</button>
                          <button type="button" onClick={() => setContentType('aniplay')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${contentType === 'aniplay' ? 'bg-indigo-500 text-black shadow-lg shadow-indigo-500/20' : 'bg-obsidian-900 text-gray-500 border border-white/10 hover:border-indigo-500/30'}`}>AniPlay Video</button>
                       </div>
                    </div>

                    <div className="space-y-2">
                       <label className="text-gray-500 text-[10px] uppercase font-black tracking-widest leading-none px-1">Metadata Title</label>
                       <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={contentType === 'news' ? "Ex: Attack on Titan Update" : "Ex: Epic Transformation 4K"} className="w-full bg-obsidian-900 border border-white/10 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all font-bold" />
                    </div>

                    {contentType === 'aniplay' && (
                      <>
                        <div className="space-y-2">
                           <label className="text-gray-500 text-[10px] uppercase font-black tracking-widest leading-none px-1">MEGA Video Link (Primary Payload)</label>
                           <input type="text" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://mega.nz/file/..." className="w-full bg-obsidian-900 border border-white/10 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all font-mono" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-gray-500 text-[10px] uppercase font-black tracking-widest leading-none px-1">Category Filter</label>
                           <div className="flex flex-wrap gap-2">
                             {['Videos', 'Genres', 'Anime Updates', 'Episodes Ratings'].map(opt => (
                               <button key={opt} type="button" onClick={() => setCategory(opt)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border ${category === opt ? 'bg-indigo-500 border-indigo-400 text-black' : 'bg-obsidian-900 border-white/5 text-gray-500 hover:border-white/20'}`}>{opt}</button>
                             ))}
                           </div>
                        </div>
                      </>
                    )}

                    {contentType === 'news' && (
                      <div className="space-y-6">
                        <div className="space-y-2">
                           <label className="text-gray-500 text-[10px] uppercase font-black tracking-widest leading-none px-1">Publish Date</label>
                           <input type="date" value={newsDate} onChange={(e) => setNewsDate(e.target.value)} className="w-full bg-obsidian-900 border border-white/10 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-gray-500 text-[10px] uppercase font-black tracking-widest leading-none px-1">Article Content</label>
                           <div className="bg-obsidian-900 rounded-xl p-1 border border-white/10 overflow-hidden">
                             <style>{`
                               .ql-toolbar.ql-snow { border: none !important; border-bottom: 1px solid rgba(255,255,255,0.05) !important; background: rgba(0,0,0,0.2); }
                               .ql-container.ql-snow { border: none !important; min-height: 200px; color: white !important; }
                               .ql-snow .ql-stroke { stroke: white !important; }
                               .ql-snow .ql-fill { fill: white !important; }
                               .ql-snow .ql-picker { color: white !important; }
                             `}</style>
                             <ReactQuill theme="snow" value={newsContent} onChange={setNewsContent} placeholder="Write here..." />
                           </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                       <label className="text-gray-500 text-[10px] uppercase font-black tracking-widest leading-none px-1">{contentType === 'news' ? 'Featured Image' : 'Thumbnail (Optional)'}</label>
                       <input type="text" value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="Image URL..." className="w-full bg-obsidian-900 border border-white/10 rounded-xl py-3.5 px-4 text-white text-sm focus:outline-none focus:border-indigo-500 transition-all" />
                    </div>

                    <button onClick={handleUpload} disabled={isUploading} className={`w-full py-4 rounded-xl text-black font-black flex items-center justify-center gap-2 transition-all shadow-lg ${isUploading ? 'bg-gray-500' : 'bg-indigo-500 hover:bg-indigo-400'}`}>
                       {isUploading ? <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : <><Upload size={20} />PUSH TO PRODUCTION</>}
                    </button>
                 </div>

                 <div className="space-y-4 pt-4">
                   <h3 className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.2em] px-1">Manage Content</h3>
                   <div className="space-y-3">
                      {aniplay.map(v => (
                        <div key={v.id} className="bg-obsidian-800 p-3 rounded-2xl border border-white/5 flex items-center gap-4 group">
                           <div className="w-12 h-16 rounded-lg overflow-hidden bg-obsidian-900 shrink-0 border border-white/5 relative">
                              {v.thumbnail ? <img src={v.thumbnail} className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center bg-indigo-500/10 text-indigo-400"><Upload size={12} /><span className="text-[6px] font-black uppercase mt-1">Auto</span></div>}
                           </div>
                           <div className="flex-1 min-w-0">
                              <h4 className="text-white font-bold text-xs truncate">{v.title}</h4>
                              <p className="text-gray-500 text-[9px] uppercase font-bold tracking-wider">{v.category}</p>
                           </div>
                           <button onClick={() => handleDelete('aniplay', v.id)} disabled={deletingId === v.id} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center opacity-60 hover:opacity-100">{deletingId === v.id ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}</button>
                        </div>
                      ))}
                      {news.map(n => (
                        <div key={n.id} className="bg-obsidian-800 p-3 rounded-2xl border border-white/5 flex items-center gap-4 group">
                           <div className="w-12 h-12 rounded-lg overflow-hidden bg-obsidian-900 shrink-0 font-bold text-[8px] flex items-center justify-center text-gray-500 uppercase">IMG</div>
                           <div className="flex-1 min-w-0">
                              <h4 className="text-white font-bold text-xs truncate">{n.title}</h4>
                              <p className="text-gray-500 text-[9px] uppercase font-bold tracking-wider">By {n.author}</p>
                           </div>
                           <button onClick={() => handleDelete('news', n.id)} disabled={deletingId === n.id} className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center opacity-60 hover:opacity-100"><Trash2 size={16} /></button>
                        </div>
                      ))}
                   </div>
                 </div>
               </div>
            </motion.div>
          )}
       </AnimatePresence>
    </div>
  );
}

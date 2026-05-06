import { Palette, Moon, Sun, Monitor, Bell, Shield, Info, Keyboard, RefreshCw, Download, CheckCircle2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useEffect } from 'react';

const AVAILABLE_VERSION = "1.0.5"; // Increase this version string to trigger an update

export default function SettingsScreen() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [notifications, setNotifications] = useState(localStorage.getItem('notifications') !== 'false');
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  
  const updateTheme = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    window.dispatchEvent(new Event('theme-change'));                
  };

  const toggleNotifications = () => {
    const newVal = !notifications;
    setNotifications(newVal);
    localStorage.setItem('notifications', String(newVal));
  };
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'available' | 'uptodate'>('idle');

  const [currentVersion, setCurrentVersion] = useState("1.0.4");
  const [latestVersion, setLatestVersion] = useState("");
  
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const savedVersion = localStorage.getItem('app_version');
    if (savedVersion) {
      setCurrentVersion(savedVersion);
    } else {
      // Initialize if first time
      localStorage.setItem('app_version', "1.0.4");
    }
  }, []);

  const checkForUpdates = () => {
    if (updateStatus === 'checking') return;
    
    setUpdateStatus('checking');
    setIsCheckingUpdate(true);
    
    // Simulate network request to check for updates
    setTimeout(() => {
      if (currentVersion !== AVAILABLE_VERSION) {
        setLatestVersion(AVAILABLE_VERSION);
        setUpdateStatus('available');
        setIsCheckingUpdate(false);
        setShowUpdateModal(true);
      } else {
        setUpdateStatus('uptodate');
        setIsCheckingUpdate(false);
        setTimeout(() => setUpdateStatus('idle'), 4000);
      }
    }, 1500);
  };

  const startUpdate = () => {
    setIsUpdating(true);
    setUpdateProgress(0);
    
    const interval = setInterval(() => {
      setUpdateProgress(prev => {
        const next = prev + Math.floor(Math.random() * 8) + 2;
        if (next >= 100) {
          clearInterval(interval);
          finishUpdate();
          return 100;
        }
        return next;
      });
    }, 250);
  };

  const finishUpdate = () => {
    setTimeout(() => {
      localStorage.setItem('app_version', latestVersion);
      // Simulate app restart by reloading the page
      window.location.reload();
    }, 800);
  };

  const themeOptions = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'device', label: 'Device', icon: Monitor },
  ];

  return (
    <div className="pb-24 pt-8 px-6">
      <h1 className="text-2xl font-black text-white mb-8">Settings</h1>

      <div className="flex flex-col gap-8">
        {/* Theme Settings */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-gray-400">
            <Palette size={18} />
            <h3 className="text-[10px] font-black uppercase tracking-widest">Appearance</h3>
          </div>
          <div className="bg-obsidian-800 rounded-2xl p-2 border border-white/5 flex gap-1">
            {themeOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => updateTheme(opt.id)}
                className={`flex-1 flex flex-col items-center gap-2 py-3 rounded-xl transition-all ${
                  theme === opt.id
                    ? 'bg-indigo-500 text-black shadow-lg shadow-indigo-500/20'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                <opt.icon size={18} />
                <span className="text-[10px] font-bold">{opt.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* General Settings */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-gray-400">
            <Bell size={18} />
            <h3 className="text-[10px] font-black uppercase tracking-widest">General</h3>
          </div>
          <div className="bg-obsidian-800 rounded-2xl border border-white/5 overflow-hidden shadow-sm">
             <div className="flex items-center justify-between p-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                      <Bell size={16} />
                   </div>
                   <span className="text-white text-sm font-medium">Notifications</span>
                </div>
                <button
                  onClick={toggleNotifications}
                  className={`w-12 h-6 rounded-full transition-colors relative ${notifications ? 'bg-indigo-500' : 'bg-gray-800'}`}
                >
                  <motion.div
                    animate={{ x: notifications ? 26 : 2 }}
                    className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                  />
                </button>
             </div>
             
             <button onClick={() => setShowPrivacyPolicy(true)} className="w-full flex items-center justify-between p-4 border-b border-white/5 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <Shield size={16} />
                   </div>
                   <span className="text-white text-sm font-medium">Privacy Policy</span>
                </div>
                <Info size={14} className="text-gray-600" />
             </button>

             <button onClick={() => setShowShortcuts(true)} className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors border-b border-white/5">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <Keyboard size={16} />
                   </div>
                   <span className="text-white text-sm font-medium">App Shortcuts</span>
                </div>
                <Info size={14} className="text-gray-600" />
             </button>
             
             {/* Check for Updates */}
             <button 
               onClick={checkForUpdates}
               disabled={updateStatus === 'checking'}
               className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
             >
                <div className="flex items-center gap-3">
                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                     updateStatus === 'uptodate' ? 'bg-green-500/10 text-green-400' :
                     updateStatus === 'available' ? 'bg-indigo-500/10 text-indigo-400' :
                     'bg-blue-500/10 text-blue-400'
                   }`}>
                      {updateStatus === 'checking' ? (
                        <RefreshCw size={16} className="animate-spin text-blue-400" />
                      ) : updateStatus === 'uptodate' ? (
                        <CheckCircle2 size={16} className="text-green-400" />
                      ) : updateStatus === 'available' ? (
                        <Download size={16} className="text-indigo-400" />
                      ) : (
                        <RefreshCw size={16} />
                      )}
                   </div>
                   <div className="flex flex-col items-start">
                     <span className="text-white text-sm font-medium">Check for Updates</span>
                     {updateStatus === 'uptodate' && (
                       <span className="text-[10px] text-green-400 font-bold uppercase tracking-widest mt-0.5">App is up to date</span>
                     )}
                     {updateStatus === 'available' && (
                       <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5">Update Available ({latestVersion})</span>
                     )}
                   </div>
                </div>
                {updateStatus !== 'uptodate' && updateStatus !== 'available' && (
                  <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">v{currentVersion}</span>
                )}
             </button>
          </div>
        </section>

        {/* About Info */}
        <div className="mt-4 text-center">
           <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mb-1">Anime Intel Hub v{currentVersion}</p>
        </div>
      </div>

      {/* Update Modal */}
      <AnimatePresence>
        {showUpdateModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#121214] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            >
              {/* Background accent */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
              
              {!isUpdating && (
                <button 
                  onClick={() => setShowUpdateModal(false)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              )}

              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-4">
                  <Download size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Update Available</h3>
                <p className="text-sm text-gray-400">
                  Version {latestVersion} is available to download. We've added new features and squashed some bugs.
                </p>
              </div>

              {isUpdating ? (
                <div className="space-y-4">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span className="text-gray-300">{updateProgress >= 100 ? 'Installing...' : 'Downloading...'}</span>
                    <span className={updateProgress >= 100 ? 'text-green-400' : 'text-indigo-400'}>{updateProgress}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-indigo-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${updateProgress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-widest text-center mt-4">
                    Please do not close the app
                  </p>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowUpdateModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-white/5 text-white hover:bg-white/10 transition-colors"
                  >
                    Later
                  </button>
                  <button 
                    onClick={startUpdate}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    Update Now
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Privacy Policy Modal */}
      <AnimatePresence>
        {showPrivacyPolicy && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#121214] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            >
              <button 
                onClick={() => setShowPrivacyPolicy(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4">
                  <Shield size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Privacy Policy</h3>
                <div className="text-sm text-gray-400 max-h-60 overflow-y-auto no-scrollbar space-y-3">
                  <p>Your privacy is important to Anime Intel Hub.</p>
                  <p>We do not collect or share personal information. Read interactions, saved anime, and history remain securely on your device.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrivacyPolicy(false)}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* App Shortcuts Modal */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm bg-[#121214] border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            >
              <button 
                onClick={() => setShowShortcuts(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="mb-6">
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
                  <Keyboard size={24} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">App Shortcuts</h3>
                <div className="text-sm text-gray-400 space-y-3">
                  <div className="flex justify-between items-center"><span className="text-white">Swipe Left/Right</span><span>Navigate Sparks</span></div>
                  <div className="flex justify-between items-center"><span className="text-white">Swipe Up/Down</span><span>Change Sparks</span></div>
                  <div className="flex justify-between items-center"><span className="text-white">Double Tap</span><span>Like Video</span></div>
                </div>
              </div>
              <button 
                onClick={() => setShowShortcuts(false)}
                className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
              >
                Done
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

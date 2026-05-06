import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation, PanInfo } from 'motion/react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const controls = useAnimation();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const PULL_THRESHOLD = 80;

  const handlePan = (_: any, info: PanInfo) => {
    if (refreshing) return;
    
    // Only allow pull if we are at the top of the scroll
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 5) return;

    const y = info.offset.y;
    if (y > 0) {
      setPulling(true);
      const dragY = Math.min(y * 0.5, PULL_THRESHOLD + 20); // Dampening
      controls.set({ y: dragY });
    }
  };

  const handlePanEnd = async (_: any, info: PanInfo) => {
    if (refreshing) return;
    
    setPulling(false);
    const y = info.offset.y * 0.5;

    if (y >= PULL_THRESHOLD) {
      setRefreshing(true);
      controls.start({ y: 40, transition: { type: 'spring', stiffness: 300, damping: 30 } });
      try {
        await onRefresh();
      } catch (e) {
        console.error("Refresh failed:", e);
      } finally {
        setRefreshing(false);
        controls.start({ y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } });
      }
    } else {
      controls.start({ y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } });
    }
  };

  return (
    <div ref={containerRef} className="relative w-full min-h-full">
      <motion.div
        className="absolute top-0 left-0 right-0 flex justify-center pt-10 z-[100] pointer-events-none"
        style={{ opacity: pulling || refreshing ? 1 : 0 }}
        animate={{ 
          y: refreshing ? 0 : 0,
          scale: pulling || refreshing ? 1 : 0.5
        }}
      >
        <div className="bg-white/20 backdrop-blur-2xl border border-white/20 rounded-full p-2.5 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
          <RefreshCw 
            size={24} 
            className={`text-white ${refreshing ? 'animate-spin' : ''}`} 
          />
        </div>
      </motion.div>
      
      <motion.div
        onPan={handlePan}
        onPanEnd={handlePanEnd}
        animate={controls}
        className="relative z-10"
      >
        {children}
      </motion.div>
    </div>
  );
}

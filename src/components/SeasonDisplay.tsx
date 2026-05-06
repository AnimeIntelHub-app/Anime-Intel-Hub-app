import { useState, useEffect } from 'react';
import { getAnimeSeasonsCount } from '../services/animeService';

export function SeasonDisplay({ animeId }: { animeId: number }) {
  const [seasons, setSeasons] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchSeasons = async () => {
      const count = await getAnimeSeasonsCount(animeId);
      if (mounted && count !== null) {
        setSeasons(count);
      }
    };
    
    // Add random delay to avoid hitting rate limit simultaneously
    const timer = setTimeout(fetchSeasons, Math.random() * 2000);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [animeId]);

  if (seasons === null) return null;

  return <span>• {seasons} {seasons === 1 ? 'Season' : 'Seasons'}</span>;
}

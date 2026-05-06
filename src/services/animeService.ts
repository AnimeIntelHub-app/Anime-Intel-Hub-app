import { Anime, NewsItem } from '../types';

const BASE_URL = 'https://api.jikan.moe/v4';
const CACHE_DURATION = 1000 * 60 * 5; // 5 minutes

// Global request queue to handle Jikan rate limits (3 requests per second limit)
let requestQueue: Promise<any> = Promise.resolve();
const REQUEST_DELAY = 150; // Radical reduction, relying on retry logic for rate limits

async function queuedFetch(url: string, options?: RequestInit, maxRetries = 4): Promise<any> {
  return new Promise((resolve, reject) => {
    requestQueue = requestQueue.then(async () => {
      let attempts = 0;
      
      const execute = async (): Promise<any> => {
        try {
          const response = await fetch(url, options);
          
          if (response.status === 429) {
            if (attempts < maxRetries) {
              attempts++;
              const backoff = (Math.pow(2, attempts) * 1000) + (Math.random() * 500);
              await new Promise(r => setTimeout(r, backoff));
              return execute();
            }
            throw new Error('Jikan API rate limit exceeded');
          }
          
          if (!response.ok) throw new Error(`Jikan error: ${response.status}`);
          
          const data = await response.json();
          return data;
        } catch (err) {
          if (attempts < maxRetries) {
            attempts++;
            await new Promise(r => setTimeout(r, 1000));
            return execute();
          }
          throw err;
        }
      };
      
      try {
        const result = await execute();
        resolve(result);
      } catch (err) {
        reject(err);
      }
      
      // Dynamic delay based on whether we hit errors
      await new Promise(r => setTimeout(r, REQUEST_DELAY));
    });
  });
}

// Global cache update listeners
const cacheListeners = new Set<(key: string, data: any) => void>();
export const onCacheUpdate = (callback: (key: string, data: any) => void) => {
  cacheListeners.add(callback);
  return () => { cacheListeners.delete(callback); };
};

async function fetchWithCache<T>(key: string, fetcher: () => Promise<T>, ignoreCache = false): Promise<T> {
  let cachedData: T | null = null;
  
  if (ignoreCache) {
    localStorage.removeItem(key);
  } else {
    try {
      const cached = localStorage.getItem(key);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        const isFresh = Date.now() - timestamp < 1000 * 60 * 30; // 30 mins
        
        if (isFresh) return data;
        cachedData = data;
      }
    } catch (e) {
      console.error("Cache read error:", e);
    }
  }

  // Trigger background fetch if not fresh or no cache
  const data = await fetcher();
  
  if (data && (!Array.isArray(data) || data.length > 0)) {
    try {
      localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
      cacheListeners.forEach(l => l(key, data));
    } catch (e) {
      console.warn("Cache write failed:", e);
    }
  }
  return data;
}

export async function getTrendingAnime(ignoreCache = false): Promise<Anime[]> {
  return fetchWithCache('trending_anime', async () => {
    const data = await queuedFetch(`${BASE_URL}/top/anime?filter=airing&limit=25`);
    const items = data.data || [];
    return Array.from(new Map(items.map((item: any) => [item.mal_id, item])).values()) as Anime[];
  }, ignoreCache);
}

export async function getRecentAnime(ignoreCache = false): Promise<Anime[]> {
  return fetchWithCache('recent_anime', async () => {
    const data = await queuedFetch(`${BASE_URL}/seasons/now?limit=25`);
    const items = data.data || [];
    return Array.from(new Map(items.map((item: any) => [item.mal_id, item])).values()) as Anime[];
  }, ignoreCache);
}

export async function getPopularAnime(ignoreCache = false): Promise<Anime[]> {
    return fetchWithCache('popular_anime', async () => {
    try {
      const results = [];
      const data = await queuedFetch(`${BASE_URL}/top/anime?filter=bypopularity&page=1`);
      if (data.data) {
        results.push(...data.data);
      }
      return Array.from(new Map(results.map(item => [item.mal_id, item])).values()) as Anime[];
    } catch (e) {
      console.error("Error fetching popular anime:", e);
      return [];
    }
  }, ignoreCache);
}

const seasonsCache = new Map<number, number | null>();

export async function getAnimeSeasonsCount(id: number): Promise<number | null> {
  if (seasonsCache.has(id)) return seasonsCache.get(id)!;
  try {
    const data = await queuedFetch(`${BASE_URL}/anime/${id}/relations`);
    let total = 1; // base season
    if (data.data) {
      data.data.forEach((rel: any) => {
        if (rel.relation === 'Prequel' || rel.relation === 'Sequel') {
          total += rel.entry.filter((e: any) => e.type === 'anime').length;
        }
      });
    }
    seasonsCache.set(id, total);
    return total;
  } catch(e) {
    return null;
  }
}

export async function searchAnime(query: string, type?: string, status?: string): Promise<Anime[]> {
  try {
    let allResults: Anime[] = [];
    let baseUrl = `${BASE_URL}/anime?q=${query}&sfw=false`;
    if (type) baseUrl += `&type=${type}`;
    if (status) baseUrl += `&status=${status}`;

    for (let page = 1; page <= 4; page++) {
      const data = await queuedFetch(`${baseUrl}&page=${page}`);
      if (data.data) {
        allResults.push(...data.data);
      }
      if (!data.pagination?.has_next_page) break;
    }
    return Array.from(new Map(allResults.map(item => [item.mal_id, item])).values()) as Anime[];
  } catch (e) {
    console.error("Search error:", e);
    return [];
  }
}

export async function getAnimeById(id: number, ignoreCache = false): Promise<Anime> {
  return fetchWithCache(`anime_${id}`, async () => {
    const data = await queuedFetch(`${BASE_URL}/anime/${id}/full`);
    return data.data;
  }, ignoreCache);
}

export async function getAnimeNews(source: 'trending' | 'latest' | 'hot' = 'trending', ignoreCache = false): Promise<NewsItem[]> {
  const cacheKey = `news_${source}`;
  if (ignoreCache) {
    localStorage.removeItem(cacheKey);
  }
  
  return fetchWithCache(cacheKey, async () => {
    try {
      let animeSource;
      let sliceStart = 0;
      let sliceEnd = 3;

      switch (source) {
        case 'latest':
          animeSource = await getRecentAnime();
          sliceStart = 2;
          sliceEnd = 5;
          break;
        case 'hot':
          animeSource = await getPopularAnime();
          sliceStart = 5;
          sliceEnd = 8;
          break;
        case 'trending':
        default:
          animeSource = await getTrendingAnime();
          sliceStart = 0;
          sliceEnd = 3;
      }
  
      if (!animeSource || animeSource.length === 0) return [];
      
      const uniqueNewsMap = new Map();
      const newsSourceAnime = animeSource.slice(sliceStart, sliceEnd);
      
      // Fetch news for the slice in parallel (respecting the queue)
      await Promise.all(newsSourceAnime.map(async (anime) => {
        try {
          const newsData = await queuedFetch(`${BASE_URL}/anime/${anime.mal_id}/news`);
          if (newsData.data) {
            newsData.data.forEach((item: any) => {
              if (!uniqueNewsMap.has(item.url)) {
                uniqueNewsMap.set(item.url, item);
              }
            });
          }
        } catch (e) {
          console.warn(`News error for ${anime.title}:`, e);
        }
      }));
  
      const allNews = Array.from(uniqueNewsMap.values());
      const sortedNews = allNews.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA === dateB) return Math.random() - 0.5;
        return dateB - dateA;
      });
      
      return sortedNews.slice(0, 30);
    } catch (e) {
      console.error(`Error fetching ${source} news:`, e);
      return [];
    }
  }, ignoreCache);
}

export async function getAnimeEpisodes(id: number, ignoreCache = false) {
  return fetchWithCache(`episodes_${id}`, async () => {
    try {
      let allEpisodes: any[] = [];
      let page = 1;
      let hasNextPage = true;
      
      while (hasNextPage && page <= 10) {
        const data = await queuedFetch(`${BASE_URL}/anime/${id}/episodes?page=${page}`);
        if (data.data) {
          allEpisodes.push(...data.data);
        }
        hasNextPage = data.pagination?.has_next_page || false;
        page++;
      }
      
      return Array.from(new Map(allEpisodes.map(ep => [ep.mal_id, ep])).values());
    } catch (e) {
      console.error("Error fetching episodes:", e);
      return [];
    }
  }, ignoreCache);
}

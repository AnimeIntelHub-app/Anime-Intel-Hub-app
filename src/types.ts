export interface Anime {
  mal_id: number;
  title: string;
  title_english: string | null;
  images: {
    jpg: {
      image_url: string;
      large_image_url: string;
    };
  };
  synopsis: string;
  genres: { name: string }[];
  status: string;
  year: number;
  duration: string;
  rating: string;
  source: string;
  episodes: number;
  type: string;
  studios: { name: string }[];
  producers: { name: string }[];
  themes: { name: string }[];
  demographics: { name: string }[];
  trailer: {
    youtube_id: string;
    url: string;
    embed_url: string;
  };
  score: number;
  scored_by: number;
  rank: number;
  popularity: number;
  members: number;
  favorites: number;
  aired?: {
    from: string;
    to: string;
    string: string;
  };
  relations?: {
    relation: string;
    entry: {
      mal_id: number;
      type: string;
      name: string;
      url: string;
    }[];
  }[];
}

export interface NewsItem {
  url: string;
  title: string;
  date: string;
  author_name: string;
  images: {
    jpg: {
      image_url: string;
    };
  };
  excerpt: string;
  content?: string;
}

export interface AniPlayVideo {
  id: string;
  title: string;
  url: string;
  category: 'Videos' | 'Genres' | 'Anime Updates' | 'Episodes Ratings' | 'All';
  thumbnail?: string;
  createdAt: string;
}

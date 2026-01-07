import { Track, cache } from '../lib/cache';

export interface TopArtist {
  name: string;
  playCount: number;
  tracks: Track[];
}

export interface Recommendations {
  recentlyPlayed: Track[];
  mostPlayed: Track[];
  topArtists: TopArtist[];
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001';

// Get recommendations for logged-in users from backend
export async function getRecommendations(): Promise<Recommendations> {
  // Import dynamically to avoid circular dependency
  const { useAuth } = await import('../lib/authStore');
  const token = useAuth.getState().token;
  
  if (!token) {
    // If no token, fall back to guest recommendations
    return getGuestRecommendations();
  }

  const response = await fetch(`${API_URL}/api/recommendations`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    // If API fails, fall back to guest recommendations
    console.warn('Failed to fetch backend recommendations, using guest mode');
    return getGuestRecommendations();
  }

  const data = await response.json();
  return data.recommendations;
}

// Get recommendations for guest users from IndexedDB
export async function getGuestRecommendations(): Promise<Recommendations> {
  const reverseQueue = await cache.getReverseQueue();

  if (reverseQueue.length === 0) {
    return {
      recentlyPlayed: [],
      mostPlayed: [],
      topArtists: []
    };
  }

  // Recently played (last 10 unique tracks)
  const recentlyPlayed = Array.from(
    new Map(
      reverseQueue
        .slice()
        .reverse() // Most recent first
        .map((t: Track) => [t.videoId, t])
    ).values()
  ).slice(0, 10) as Track[];

  // Most played (count occurrences)
  const playCountMap = new Map<string, { track: Track; count: number }>();
  
  reverseQueue.forEach((track: Track) => {
    const existing = playCountMap.get(track.videoId);
    if (existing) {
      existing.count++;
    } else {
      playCountMap.set(track.videoId, { track, count: 1 });
    }
  });

  const mostPlayed = Array.from(playCountMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(item => item.track);

  // Top artists (aggregate by artist name)
  const artistMap = new Map<string, { tracks: Track[]; playCount: number }>();

  reverseQueue.forEach((track: Track) => {
    const existing = artistMap.get(track.artist);
    if (existing) {
      existing.playCount++;
      // Only add unique tracks
      if (!existing.tracks.some(t => t.videoId === track.videoId)) {
        existing.tracks.push(track);
      }
    } else {
      artistMap.set(track.artist, {
        tracks: [track],
        playCount: 1
      });
    }
  });

  const topArtists: TopArtist[] = Array.from(artistMap.entries())
    .sort((a, b) => b[1].playCount - a[1].playCount)
    .slice(0, 5)
    .map(([name, data]) => ({
      name,
      playCount: data.playCount,
      tracks: data.tracks.slice(0, 8) // Max 8 tracks per artist
    }));

  return {
    recentlyPlayed,
    mostPlayed,
    topArtists
  };
}

import { create } from 'zustand';
import { LyricsData, SyncedLine, parseSyncedLyrics } from '../services/lyrics';

interface LyricsCacheEntry {
  lyrics: LyricsData | null;
  syncedLines: SyncedLine[];
  fetchedAt: number;
}

interface LyricsStore {
  cache: Map<string, LyricsCacheEntry>;
  currentTrackKey: string | null;
  
  // Get cached lyrics for a track
  getCached: (trackId: string) => LyricsCacheEntry | null;
  
  // Set lyrics for a track
  setLyrics: (trackId: string, lyrics: LyricsData | null) => void;
  
  // Clear cache for a specific track
  clearTrack: (trackId: string) => void;
  
  // Clear all cache
  clearAll: () => void;
  
  // Set current track (for knowing which is active)
  setCurrentTrack: (trackId: string | null) => void;
}

// Cache lyrics for 1 hour, but failed lookups only for 5 minutes
const CACHE_TTL = 60 * 60 * 1000;
const FAILED_CACHE_TTL = 5 * 60 * 1000;

export const useLyricsStore = create<LyricsStore>((set, get) => ({
  cache: new Map(),
  currentTrackKey: null,
  
  getCached: (trackId: string) => {
    const entry = get().cache.get(trackId);
    if (!entry) return null;
    
    // Use shorter TTL for failed lookups (no lyrics)
    const ttl = entry.lyrics ? CACHE_TTL : FAILED_CACHE_TTL;
    
    // Check if cache is still valid
    if (Date.now() - entry.fetchedAt > ttl) {
      get().clearTrack(trackId);
      return null;
    }
    
    return entry;
  },
  
  setLyrics: (trackId: string, lyrics: LyricsData | null) => {
    const syncedLines = lyrics?.syncedLyrics 
      ? parseSyncedLyrics(lyrics.syncedLyrics) 
      : [];
    
    set((state) => {
      const newCache = new Map(state.cache);
      newCache.set(trackId, {
        lyrics,
        syncedLines,
        fetchedAt: Date.now(),
      });
      
      // Limit cache size to 50 entries
      if (newCache.size > 50) {
        const oldest = [...newCache.entries()]
          .sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)[0];
        if (oldest) {
          newCache.delete(oldest[0]);
        }
      }
      
      return { cache: newCache };
    });
  },
  
  clearTrack: (trackId: string) => {
    set((state) => {
      const newCache = new Map(state.cache);
      newCache.delete(trackId);
      return { cache: newCache };
    });
  },
  
  clearAll: () => {
    set({ cache: new Map() });
  },
  
  setCurrentTrack: (trackId: string | null) => {
    set({ currentTrackKey: trackId });
  },
}));

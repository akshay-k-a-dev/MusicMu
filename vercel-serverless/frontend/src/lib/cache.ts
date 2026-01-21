import localforage from 'localforage';

export interface Track {
  videoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
}

export interface Playlist {
  id: string;
  title: string;
  tracks: Track[];
  createdAt: number;
}

export interface LyricsCache {
  trackKey: string; // "artist - title"
  data: any; // LyricsData from lyrics service
  timestamp: number;
}

export interface GuestCache {
  playlists: Playlist[];
  liked: Track[];
  queue: Track[]; // Forward queue - songs to play next
  reverseQueue: Track[]; // Reverse queue (stack) - songs already played
  lastPlayed: Track | null;
  lyrics: { [key: string]: LyricsCache }; // Cached lyrics
  discoveredTracks: Track[]; // Tracks from search that user hasn't played yet
  playedVideoIds: string[]; // IDs of tracks user has played
  version: number;
}

const CACHE_VERSION = 1;
const CACHE_EXPIRY_DAYS = 30;

// Initialize localforage
const store = localforage.createInstance({
  name: 'cantio',
  storeName: 'guest_data',
});

// Default cache structure
const defaultCache: GuestCache = {
  playlists: [],
  liked: [],
  queue: [],
  reverseQueue: [],
  lastPlayed: null,
  lyrics: {},
  discoveredTracks: [],
  playedVideoIds: [],
  version: CACHE_VERSION,
};

export class CacheManager {
  private static instance: CacheManager;
  private cache: GuestCache | null = null;

  private constructor() {}

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  async init(): Promise<void> {
    try {
      const cached = await store.getItem<GuestCache>('data');
      const timestamp = await store.getItem<number>('timestamp');

      // Check if cache is expired or version mismatch
      if (cached && timestamp) {
        const now = Date.now();
        const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        
        if (
          now - timestamp < expiryTime &&
          cached.version === CACHE_VERSION
        ) {
          // Migrate missing fields from older cache versions
          this.cache = {
            ...defaultCache,
            ...cached,
            discoveredTracks: cached.discoveredTracks || [],
            playedVideoIds: cached.playedVideoIds || [],
            lyrics: cached.lyrics || {},
          };
          console.log('✓ Guest cache loaded');
          return;
        }
      }

      // Initialize fresh cache
      this.cache = { ...defaultCache };
      await this.save();
      console.log('✓ Fresh guest cache initialized');
    } catch (error) {
      console.error('Cache init error:', error);
      this.cache = { ...defaultCache };
    }
  }

  async save(): Promise<void> {
    if (!this.cache) return;
    
    try {
      await store.setItem('data', this.cache);
      await store.setItem('timestamp', Date.now());
    } catch (error) {
      console.error('Cache save error:', error);
    }
  }

  getCache(): GuestCache {
    return this.cache || { ...defaultCache };
  }

  // Playlists
  async createPlaylist(title: string): Promise<Playlist> {
    const playlist: Playlist = {
      id: `pl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title,
      tracks: [],
      createdAt: Date.now(),
    };

    this.cache!.playlists.push(playlist);
    await this.save();
    return playlist;
  }

  async addToPlaylist(playlistId: string, track: Track): Promise<void> {
    const playlist = this.cache!.playlists.find(p => p.id === playlistId);
    if (!playlist) throw new Error('Playlist not found');

    // Avoid duplicates
    if (!playlist.tracks.find(t => t.videoId === track.videoId)) {
      // Add newest tracks to the front so latest added appears first
      playlist.tracks.unshift(track);
      await this.save();
    }
  }

  async removeFromPlaylist(playlistId: string, videoId: string): Promise<void> {
    const playlist = this.cache!.playlists.find(p => p.id === playlistId);
    if (!playlist) throw new Error('Playlist not found');

    playlist.tracks = playlist.tracks.filter(t => t.videoId !== videoId);
    await this.save();
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    this.cache!.playlists = this.cache!.playlists.filter(p => p.id !== playlistId);
    await this.save();
  }

  async renamePlaylist(playlistId: string, newTitle: string): Promise<void> {
    const playlist = this.cache!.playlists.find(p => p.id === playlistId);
    if (!playlist) throw new Error('Playlist not found');
    
    playlist.title = newTitle;
    await this.save();
  }

  // Liked songs
  async likeSong(track: Track): Promise<void> {
    if (!this.cache!.liked.find(t => t.videoId === track.videoId)) {
      this.cache!.liked.push(track);
      await this.save();
    }
  }

  async unlikeSong(videoId: string): Promise<void> {
    this.cache!.liked = this.cache!.liked.filter(t => t.videoId !== videoId);
    await this.save();
  }

  isLiked(videoId: string): boolean {
    return this.cache!.liked.some(t => t.videoId === videoId);
  }

  getLikedSongs(): Track[] {
    return [...this.cache!.liked];
  }

  // Queue management
  async addToQueue(track: Track): Promise<void> {
    this.cache!.queue.push(track);
    await this.save();
  }

  async removeFromQueue(index: number): Promise<void> {
    this.cache!.queue.splice(index, 1);
    await this.save();
  }

  async clearQueue(): Promise<void> {
    this.cache!.queue = [];
    await this.save();
  }

  async reorderQueue(fromIndex: number, toIndex: number): Promise<void> {
    const [item] = this.cache!.queue.splice(fromIndex, 1);
    this.cache!.queue.splice(toIndex, 0, item);
    await this.save();
  }

  // Last played
  async setLastPlayed(track: Track): Promise<void> {
    this.cache!.lastPlayed = track;
    await this.save();
  }

  // Reverse Queue management (for previous button - stack/LIFO)
  async pushToReverseQueue(track: Track): Promise<void> {
    // Add track to reverse queue (push to stack)
    const lastInReverseQueue = this.cache!.reverseQueue[this.cache!.reverseQueue.length - 1];
    if (!lastInReverseQueue || lastInReverseQueue.videoId !== track.videoId) {
      this.cache!.reverseQueue.push(track);
      
      // Keep reverse queue limited to last 100 tracks to avoid memory issues
      if (this.cache!.reverseQueue.length > 100) {
        this.cache!.reverseQueue.shift();
      }
      
      await this.save();
    }
  }

  async getReverseQueue(): Promise<Track[]> {
    return [...this.cache!.reverseQueue] as Track[];
  }

  async popFromReverseQueue(): Promise<Track | null> {
    const track = this.cache!.reverseQueue.pop();
    if (track) {
      await this.save();
    }
    return track || null;
  }

  async clearReverseQueue(): Promise<void> {
    this.cache!.reverseQueue = [];
    await this.save();
  }

  // Lyrics cache methods
  async getLyrics(trackTitle: string, artistName: string): Promise<any | null> {
    const key = `${artistName.toLowerCase()} - ${trackTitle.toLowerCase()}`;
    const cached = this.cache!.lyrics[key];
    
    if (!cached) return null;
    
    // Cache lyrics for 7 days
    const LYRICS_CACHE_DAYS = 7;
    const expiryTime = LYRICS_CACHE_DAYS * 24 * 60 * 60 * 1000;
    
    if (Date.now() - cached.timestamp > expiryTime) {
      // Expired, remove it
      delete this.cache!.lyrics[key];
      await this.save();
      return null;
    }
    
    return cached.data;
  }

  async setLyrics(trackTitle: string, artistName: string, data: any): Promise<void> {
    const key = `${artistName.toLowerCase()} - ${trackTitle.toLowerCase()}`;
    this.cache!.lyrics[key] = {
      trackKey: key,
      data,
      timestamp: Date.now(),
    };
    
    // Keep only last 100 lyrics to avoid storage bloat
    const lyricsKeys = Object.keys(this.cache!.lyrics);
    if (lyricsKeys.length > 100) {
      // Remove oldest entries
      const sorted = lyricsKeys.sort((a, b) => 
        this.cache!.lyrics[a].timestamp - this.cache!.lyrics[b].timestamp
      );
      for (let i = 0; i < sorted.length - 100; i++) {
        delete this.cache!.lyrics[sorted[i]];
      }
    }
    
    await this.save();
  }

  // Export/Import for migration
  exportData(): GuestCache {
    return { ...this.cache! };
  }

  async importData(data: GuestCache): Promise<void> {
    this.cache = data;
    await this.save();
  }

  async clearAll(): Promise<void> {
    this.cache = { ...defaultCache };
    await store.clear();
    await this.save();
  }

  // Discovered tracks methods (for "For You" section)
  async addDiscoveredTracks(tracks: Track[]): Promise<void> {
    if (!this.cache) await this.init();
    
    // Ensure arrays exist (migration safety)
    if (!this.cache!.playedVideoIds) this.cache!.playedVideoIds = [];
    if (!this.cache!.discoveredTracks) this.cache!.discoveredTracks = [];
    
    const playedIds = new Set(this.cache!.playedVideoIds);
    const existingIds = new Set(this.cache!.discoveredTracks.map(t => t.videoId));
    
    // Add only new tracks that haven't been played
    const newTracks = tracks.filter(t => 
      !playedIds.has(t.videoId) && !existingIds.has(t.videoId)
    );
    
    this.cache!.discoveredTracks = [...newTracks, ...this.cache!.discoveredTracks];
    
    // Keep only last 50 discovered tracks
    if (this.cache!.discoveredTracks.length > 50) {
      this.cache!.discoveredTracks = this.cache!.discoveredTracks.slice(0, 50);
    }
    
    await this.save();
  }

  async getDiscoveredTracks(): Promise<Track[]> {
    if (!this.cache) await this.init();
    
    // Ensure arrays exist (migration safety)
    const discoveredTracks = this.cache!.discoveredTracks || [];
    const playedVideoIds = this.cache!.playedVideoIds || [];
    
    // Filter out any tracks that have since been played
    const playedIds = new Set(playedVideoIds);
    return discoveredTracks.filter(t => !playedIds.has(t.videoId));
  }

  async markTrackAsPlayed(videoId: string): Promise<void> {
    if (!this.cache) await this.init();
    
    // Ensure arrays exist (migration safety)
    if (!this.cache!.playedVideoIds) this.cache!.playedVideoIds = [];
    if (!this.cache!.discoveredTracks) this.cache!.discoveredTracks = [];
    
    if (!this.cache!.playedVideoIds.includes(videoId)) {
      this.cache!.playedVideoIds.push(videoId);
      
      // Keep only last 500 played IDs
      if (this.cache!.playedVideoIds.length > 500) {
        this.cache!.playedVideoIds = this.cache!.playedVideoIds.slice(-500);
      }
      
      // Remove from discovered
      this.cache!.discoveredTracks = this.cache!.discoveredTracks.filter(
        t => t.videoId !== videoId
      );
      
      await this.save();
    }
  }
}

export const cache = CacheManager.getInstance();

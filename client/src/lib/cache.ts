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

export interface GuestCache {
  playlists: Playlist[];
  liked: Track[];
  queue: Track[]; // Forward queue - songs to play next
  reverseQueue: Track[]; // Reverse queue (stack) - songs already played
  lastPlayed: Track | null;
  version: number;
}

const CACHE_VERSION = 1;
const CACHE_EXPIRY_DAYS = 30;

// Initialize localforage
const store = localforage.createInstance({
  name: 'musicmu',
  storeName: 'guest_data',
});

// Default cache structure
const defaultCache: GuestCache = {
  playlists: [],
  liked: [],
  queue: [],
  reverseQueue: [],
  lastPlayed: null,
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
          this.cache = cached;
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
      playlist.tracks.push(track);
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
    return [...this.cache!.reverseQueue];
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
}

export const cache = CacheManager.getInstance();

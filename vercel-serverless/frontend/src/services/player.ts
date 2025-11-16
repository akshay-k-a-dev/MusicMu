import { create } from 'zustand';
import { cache, Track } from '../lib/cache';
import { mediaSessionManager } from '../lib/mediaSession';

// Determine API base URL dynamically
const getApiBase = () => {
  // In production, use VITE_API_URL from .env.production
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api`;
  }
  
  // In development, use proxy
  return '/api';
};

const API_BASE = getApiBase();

export type PlayerState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';
export type PlaybackMode = 'iframe'; // Only iframe mode now

// YouTube IFrame Player API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface PlayerStore {
  // State
  state: PlayerState;
  mode: PlaybackMode;
  currentTrack: Track | null;
  queue: Track[];
  volume: number;
  progress: number;
  duration: number;
  error: string | null;
  
  // YouTube IFrame player instance
  ytPlayer: any | null;
  ytPlayerReady: boolean;
  
  // Actions
  search: (query: string, limit?: number) => Promise<Track[]>;
  play: (track: Track) => Promise<void>;
  _playInternal: (track: Track) => Promise<void>;
  togglePlay: () => void;
  next: () => Promise<void>;
  prev: () => Promise<void>;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  addToQueue: (track: Track) => Promise<void>;
  removeFromQueue: (index: number) => Promise<void>;
  clearQueue: () => Promise<void>;
  like: (track: Track) => Promise<void>;
  unlike: (videoId: string) => Promise<void>;
  isLiked: (videoId: string) => boolean;
  init: () => Promise<void>;
  initYouTubePlayer: () => Promise<void>;
}

export const usePlayer = create<PlayerStore>((set, get) => ({
  state: 'idle',
  mode: 'iframe',
  currentTrack: null,
  queue: [],
  volume: 1.0, // Increased from 0.7 to 1.0 (100%)
  progress: 0,
  duration: 0,
  error: null,
  ytPlayer: null,
  ytPlayerReady: false,

  init: async () => {
    await cache.init();
    const cached = cache.getCache();
    
    set({ 
      queue: cached.queue,
      currentTrack: cached.lastPlayed,
    });

    // Initialize YouTube IFrame API
    await get().initYouTubePlayer();
    
    // Register media session handlers for background playback
    mediaSessionManager.setHandlers({
      play: () => get().togglePlay(),
      pause: () => get().togglePlay(),
      nextTrack: () => get().next(),
      previousTrack: () => get().prev(),
      seekTo: (details) => {
        if (details.seekTime !== undefined) {
          get().seek(details.seekTime);
        }
      },
    });
    
    // 🔥 WATCHDOG: Continuously monitor and force resume if paused in background
    setInterval(() => {
      const { state, ytPlayer, ytPlayerReady } = get();
      
      // Only run watchdog if we should be playing and page is hidden
      if (state === 'playing' && ytPlayer && ytPlayerReady && document.visibilityState === 'hidden') {
        const YT = window.YT;
        const ytState = ytPlayer.getPlayerState();
        
        if (ytState === YT.PlayerState.PAUSED) {
          console.log('🐕 WATCHDOG: Detected pause in background, force resuming');
          ytPlayer.playVideo();
        }
      }
    }, 1000); // Check every second
  },

  initYouTubePlayer: async () => {
    // Create hidden container for YouTube player
    let container = document.getElementById('yt-player-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'yt-player-container';
      container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(container);
    }

    // Load YouTube IFrame API if not loaded
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
      
      // Wait for API to load
      await new Promise<void>((resolve) => {
        window.onYouTubeIframeAPIReady = () => resolve();
      });
    }

    // Create YouTube player instance
    const player = new window.YT.Player(container, {
      height: '1',
      width: '1',
      playerVars: {
        autoplay: 0,
        controls: 0,
        enablejsapi: 1,
        origin: window.location.origin,
        playsinline: 1,
        rel: 0,
      },
      events: {
        onReady: () => {
          console.log('✅ YouTube IFrame Player ready');
          player.setVolume(get().volume * 100);
          set({ ytPlayerReady: true });
        },
        onStateChange: (event: any) => {
          const YT = window.YT;
          
          if (event.data === YT.PlayerState.PLAYING) {
            set({ state: 'playing', error: null });
            
            // Start progress tracking
            const trackProgress = () => {
              if (get().state === 'playing' && get().ytPlayer) {
                try {
                  const currentTime = player.getCurrentTime();
                  const duration = player.getDuration();
                  set({ progress: currentTime || 0, duration: duration || 0 });
                  requestAnimationFrame(trackProgress);
                } catch (e) {
                  // Player might be destroyed
                }
              }
            };
            trackProgress();
            
          } else if (event.data === YT.PlayerState.PAUSED) {
            // AGGRESSIVE: Only accept pause if page is visible AND we're actually pausing
            if (document.visibilityState === 'visible') {
              set({ state: 'paused' });
            } else {
              // Background auto-pause detected - FORCE RESUME immediately
              console.log('⚠️ YouTube auto-paused in background - FORCE RESUMING NOW');
              
              // Try multiple times to ensure it resumes (aggressive approach)
              const forceResume = () => {
                if (get().state === 'playing' && player) {
                  player.playVideo();
                }
              };
              
              setTimeout(forceResume, 50);
              setTimeout(forceResume, 100);
              setTimeout(forceResume, 200);
            }
          } else if (event.data === YT.PlayerState.BUFFERING) {
            set({ state: 'loading' });
          } else if (event.data === YT.PlayerState.ENDED) {
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log('✅ TRACK COMPLETED:', get().currentTrack?.title);
            console.log('⏭️  Playing next track from queue...');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            get().next();
          }
        },
        onError: (event: any) => {
          console.error('YouTube player error:', event.data);
          set({ state: 'error', error: 'Playback error' });
          // Try next track on error
          setTimeout(() => get().next(), 2000);
        },
      },
    });

    set({ ytPlayer: player });
    
    // ✅ AGGRESSIVE: Prevent YouTube auto-pause on visibility change
    document.addEventListener('visibilitychange', () => {
      const { state: playerState, ytPlayer: currentPlayer } = get();
      
      if (document.visibilityState === 'hidden') {
        // App going to background - FORCE resume after YouTube auto-pauses
        console.log('📱 App going to background, forcing playback to continue');
        
        // Aggressively resume within 80ms (before YouTube fully pauses)
        setTimeout(() => {
          if (currentPlayer && playerState === 'playing') {
            const ytState = currentPlayer.getPlayerState();
            const YT = window.YT;
            
            if (ytState === YT.PlayerState.PAUSED) {
              console.log('🔄 FORCE-RESUMING after YouTube auto-pause');
              currentPlayer.playVideo();
            }
          }
        }, 80);
        
      } else if (document.visibilityState === 'visible') {
        // App coming to foreground
        console.log('📱 App coming to foreground');
        
        // Re-acquire wake lock
        mediaSessionManager.acquireWakeLock();
        
        // Check if we need to resume
        if (playerState === 'playing' && currentPlayer) {
          const ytState = currentPlayer.getPlayerState();
          const YT = window.YT;
          
          if (ytState === YT.PlayerState.PAUSED) {
            console.log('🔄 Auto-resuming playback after returning to foreground');
            currentPlayer.playVideo();
          }
        }
      }
    });
    
    // Handle page freeze/unfreeze events (PWA lifecycle)
    document.addEventListener('freeze', () => {
      console.log('📱 Page frozen, attempting to keep playback alive');
    });
    
    document.addEventListener('resume', () => {
      console.log('📱 Page resumed');
      const { state: playerState, ytPlayer: currentPlayer } = get();
      
      if (playerState === 'playing' && currentPlayer) {
        setTimeout(() => {
          const ytState = currentPlayer.getPlayerState();
          const YT = window.YT;
          
          if (ytState === YT.PlayerState.PAUSED) {
            console.log('🔄 Force resume after page resume');
            currentPlayer.playVideo();
          }
        }, 50);
      }
    });
  },

  search: async (query: string, limit: number = 10) => {
    try {
      const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}&limit=${limit}`);
      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Search error:', error);
      throw new Error('Failed to search');
    }
  },

  play: async (track: Track) => {
    await get()._playInternal(track);
  },

  _playInternal: async (track: Track) => {
    const { ytPlayer, ytPlayerReady, currentTrack: previousTrack } = get();

    if (!ytPlayer || !ytPlayerReady) {
      console.error('YouTube player not ready');
      set({ error: 'Player not ready' });
      return;
    }

    // 🔄 REVERSE QUEUE LOGIC: Push previous track to reverse queue (history stack)
    if (previousTrack && previousTrack.videoId !== track.videoId) {
      await cache.pushToReverseQueue(previousTrack);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⬅️  PUSHED TO REVERSE QUEUE:', previousTrack.title);
      const reverseQueue = await cache.getReverseQueue();
      console.log('📚 Reverse queue length:', reverseQueue.length);
      console.log('📋 Reverse queue:', reverseQueue.map(t => t.title).join(' ← '));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    // Remove track from queue if it exists (normal queue behavior)
    const { queue } = get();
    const trackIndex = queue.findIndex(t => t.videoId === track.videoId);
    if (trackIndex !== -1) {
      const newQueue = queue.filter((_, i) => i !== trackIndex);
      set({ queue: newQueue });
      await cache.removeFromQueue(trackIndex);
      console.log('🗑️ Removed from queue:', track.title);
    }

    // Set state immediately
    set({ 
      state: 'loading', 
      currentTrack: track, 
      error: null,
      progress: 0,
      duration: track.duration || 0
    });

    console.log('🎵 Playing track:', track.title, 'by', track.artist);

    // Update media session metadata for background playback
    mediaSessionManager.updateMetadata(track);
    mediaSessionManager.updatePlaybackState('playing');
    await mediaSessionManager.acquireWakeLock();

    try {
      console.log('📺 Loading video:', track.videoId);

      // Load and play video directly (no stream fetch needed for iframe)
      ytPlayer.loadVideoById({
        videoId: track.videoId,
        startSeconds: 0,
      });

      // Update cache
      await cache.setLastPlayed(track);

    } catch (error) {
      console.error('Play error:', error);
      set({ state: 'error', error: 'Failed to play track' });
      
      // Auto-try next track on error
      setTimeout(() => {
        get().next();
      }, 2000);
    }
  },

  togglePlay: () => {
    const { ytPlayer, state, currentTrack, ytPlayerReady } = get();
    
    if (!currentTrack || !ytPlayer || !ytPlayerReady) return;

    if (state === 'playing') {
      ytPlayer.pauseVideo();
      mediaSessionManager.updatePlaybackState('paused');
    } else if (state === 'paused') {
      ytPlayer.playVideo();
      mediaSessionManager.updatePlaybackState('playing');
      mediaSessionManager.acquireWakeLock();
    } else if (state === 'idle' && currentTrack) {
      // Reload current track
      get().play(currentTrack);
    }
  },

  next: async () => {
    const { queue, currentTrack } = get();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏭️  NEXT BUTTON CLICKED');
    if (currentTrack) {
      console.log('⏩ SKIPPING:', currentTrack.title);
    }
    console.log('📝 Queue length:', queue.length);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (queue.length > 0) {
      await get().play(queue[0]);
    } else {
      // Queue is empty, stop playback
      const { ytPlayer } = get();
      if (ytPlayer) {
        ytPlayer.stopVideo();
      }
      
      set({ 
        state: 'idle', 
        currentTrack: null, 
        progress: 0, 
        duration: 0
      });
      
      // Release wake lock and update media session
      mediaSessionManager.updatePlaybackState('none');
      mediaSessionManager.releaseWakeLock();
      
      console.log('📭 Queue empty, stopped playback');
    }
  },

  prev: async () => {
    const { progress, currentTrack } = get();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('⏮️  PREVIOUS BUTTON CLICKED');
    console.log('⏱️  Current progress:', progress.toFixed(1), 'seconds');
    
    // If more than 3 seconds in, restart current track (first click)
    if (progress > 3) {
      console.log('🔄 Restarting current track (>3s played)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      get().seek(0);
      return;
    }

    // Check if there's a previous track in reverse queue
    const reverseQueue = await cache.getReverseQueue();
    console.log('📚 Reverse queue length:', reverseQueue.length);
    console.log('📋 Reverse queue:', reverseQueue.map(t => t.title).join(' ← '));
    
    if (reverseQueue.length === 0) {
      // No history available, just restart current track
      console.log('❌ No previous track in reverse queue, restarting current');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      if (currentTrack) {
        get().seek(0);
      }
      return;
    }

    // Pop the previous track from reverse queue (LIFO - stack behavior)
    const previousTrack = await cache.popFromReverseQueue();
    if (!previousTrack) {
      console.log('❌ No previous track found, restarting current');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      if (currentTrack) {
        get().seek(0);
      }
      return;
    }

    console.log('⏮️  Going back to:', previousTrack.title);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // 🔄 REVERSE QUEUE LOGIC: Push current track to FRONT of queue
    // So when user presses Next, they go back to where they were
    if (currentTrack && currentTrack.videoId !== previousTrack.videoId) {
      const { queue } = get();
      const newQueue = [currentTrack, ...queue];
      set({ queue: newQueue });
      await cache.clearQueue();
      for (const track of newQueue) {
        await cache.addToQueue(track);
      }
      console.log('➡️  Pushed current track to front of queue:', currentTrack.title);
    }
    
    // Play the previous track WITHOUT adding to reverse queue
    // (it was already popped from reverse queue)
    await get()._playInternal(previousTrack);
  },

  seek: (seconds: number) => {
    const { ytPlayer, ytPlayerReady } = get();
    
    if (ytPlayer && ytPlayerReady) {
      ytPlayer.seekTo(seconds, true);
      set({ progress: seconds });
    }
  },

  setVolume: (volume: number) => {
    const { ytPlayer } = get();
    const clampedVolume = Math.max(0, Math.min(1, volume));
    
    if (ytPlayer) {
      ytPlayer.setVolume(clampedVolume * 100);
    }
    
    set({ volume: clampedVolume });
  },

  addToQueue: async (track: Track) => {
    const { queue } = get();
    const newQueue = [...queue, track];
    set({ queue: newQueue });
    await cache.addToQueue(track);
  },

  removeFromQueue: async (index: number) => {
    const { queue } = get();
    const newQueue = queue.filter((_, i) => i !== index);
    set({ queue: newQueue });
    await cache.removeFromQueue(index);
  },

  clearQueue: async () => {
    set({ queue: [] });
    await cache.clearQueue();
  },

  like: async (track: Track) => {
    await cache.likeSong(track);
  },

  unlike: async (videoId: string) => {
    await cache.unlikeSong(videoId);
  },

  isLiked: (videoId: string) => {
    return cache.isLiked(videoId);
  },
}));

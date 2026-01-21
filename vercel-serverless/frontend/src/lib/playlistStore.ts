import { create } from 'zustand';
import { useAuth } from './authStore';

const API_URL = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : 'http://localhost:4001/api';

export interface Playlist {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    tracks: number;
  };
  tracks?: PlaylistTrack[];
  user?: {
    id: string;
    username: string;
    name: string | null;
    avatar: string | null;
  };
}

export interface PlaylistTrack {
  id: string;
  playlistId: string;
  trackId: string;
  title: string;
  artist: string;
  thumbnail: string | null;
  duration: number | null;
  position: number;
  addedAt: string;
}

interface PlaylistState {
  playlists: Playlist[];
  currentPlaylist: Playlist | null;
  loading: boolean;
  lastFetch: number | null;
  fetchPlaylists: (force?: boolean) => Promise<void>;
  createPlaylist: (name: string, description?: string, isPublic?: boolean) => Promise<Playlist>;
  getPlaylist: (id: string) => Promise<Playlist>;
  addTrackToPlaylist: (playlistId: string, track: {
    trackId: string;
    title: string;
    artist: string;
    thumbnail?: string;
    duration?: number;
  }) => Promise<void>;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  updatePlaylist: (id: string, data: { name?: string; description?: string; isPublic?: boolean }) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  setCurrentPlaylist: (playlist: Playlist | null) => void;
}

export const usePlaylist = create<PlaylistState>((set, get) => ({
  playlists: [],
  currentPlaylist: null,
  loading: false,
  lastFetch: null,

  fetchPlaylists: async (force = false) => {
    const token = useAuth.getState().token;
    if (!token) return;

    const state = get();
    const now = Date.now();
    
    // Skip if fetched within last 1 second and not forced (very short cache)
    if (!force && state.lastFetch && (now - state.lastFetch) < 1000) {
      return;
    }

    set({ loading: true });
    try {
      const response = await fetch(`${API_URL}/playlists`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch playlists');

      const data = await response.json();
      set({ playlists: data.playlists, loading: false, lastFetch: now });
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
      set({ loading: false });
    }
  },

  createPlaylist: async (name: string, description?: string, isPublic = false) => {
    const token = useAuth.getState().token;
    if (!token) throw new Error('Not authenticated');

    const { playlists } = get();
    if (playlists.length >= 15) {
      throw new Error('Maximum 15 playlists allowed');
    }

    // Optimistic update - create temp playlist immediately
    const tempId = `temp-${Date.now()}`;
    const tempPlaylist: Playlist = {
      id: tempId,
      userId: '',
      name,
      description: description || null,
      thumbnail: null,
      isPublic,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _count: { tracks: 0 }
    };
    
    // Immediately show the new playlist
    set({ playlists: [tempPlaylist, ...playlists] });

    // Then sync with server in background
    const response = await fetch(`${API_URL}/playlists`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name, description, isPublic })
    });

    if (!response.ok) {
      // Rollback on error
      set({ playlists });
      throw new Error('Failed to create playlist');
    }

    const data = await response.json();
    // Replace temp with real playlist and update lastFetch to ensure list is fresh
    const finalPlaylists = get().playlists.map(p => 
      p.id === tempId ? data.playlist : p
    );
    set({ playlists: finalPlaylists, lastFetch: Date.now() });
    return data.playlist;
  },

  getPlaylist: async (id: string) => {
    const token = useAuth.getState().token;
    if (!token) throw new Error('Not authenticated');

    const response = await fetch(`${API_URL}/playlists/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Failed to fetch playlist');

    const data = await response.json();
    set({ currentPlaylist: data.playlist });
    return data.playlist;
  },

  addTrackToPlaylist: async (playlistId: string, track) => {
    const token = useAuth.getState().token;
    if (!token) throw new Error('Not authenticated');

    // Optimistic update FIRST - instant UI feedback
    const { playlists } = get();
    const updatedPlaylists = playlists.map(p => {
      if (p.id === playlistId) {
        return {
          ...p,
          _count: { tracks: (p._count?.tracks || 0) + 1 }
        };
      }
      return p;
    });
    set({ playlists: updatedPlaylists });

    // Then sync with server in background
    const response = await fetch(`${API_URL}/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(track)
    });

    if (!response.ok) {
      // Rollback on error
      set({ playlists });
      const error = await response.json();
      throw new Error(error.error || 'Failed to add track to playlist');
    }

    // On success, update current playlist UI if viewing it so the new track appears immediately
    const data = await response.json();
    const { currentPlaylist } = get();

    if (currentPlaylist && currentPlaylist.id === playlistId) {
      set({
        currentPlaylist: {
          ...currentPlaylist,
          // Prepend newest track so latest appears first
          tracks: [data.track, ...(currentPlaylist.tracks || [])],
          _count: { tracks: (currentPlaylist._count?.tracks || 0) + 1 }
        }
      });
    }
  },

  removeTrackFromPlaylist: async (playlistId: string, trackId: string) => {
    const token = useAuth.getState().token;
    if (!token) throw new Error('Not authenticated');

    // Optimistic update FIRST
    const { playlists, currentPlaylist } = get();
    const updatedPlaylists = playlists.map(p => {
      if (p.id === playlistId) {
        return {
          ...p,
          _count: { tracks: Math.max(0, (p._count?.tracks || 1) - 1) }
        };
      }
      return p;
    });
    
    // Also update currentPlaylist if viewing this playlist
    let updatedCurrentPlaylist = currentPlaylist;
    if (currentPlaylist?.id === playlistId && currentPlaylist.tracks) {
      updatedCurrentPlaylist = {
        ...currentPlaylist,
        tracks: currentPlaylist.tracks.filter(t => t.trackId !== trackId)
      };
    }
    
    set({ playlists: updatedPlaylists, currentPlaylist: updatedCurrentPlaylist });

    const response = await fetch(`${API_URL}/playlists/${playlistId}/tracks/${trackId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      // Rollback on error
      set({ playlists, currentPlaylist });
      throw new Error('Failed to remove track from playlist');
    }
  },

  updatePlaylist: async (id: string, data) => {
    const token = useAuth.getState().token;
    if (!token) throw new Error('Not authenticated');

    // Optimistic update FIRST
    const { playlists } = get();
    const updatedPlaylists = playlists.map(p => 
      p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString() } : p
    );
    set({ playlists: updatedPlaylists });

    const response = await fetch(`${API_URL}/playlists/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      // Rollback on error
      set({ playlists });
      throw new Error('Failed to update playlist');
    }
    // No need to re-fetch - optimistic update already done
  },

  deletePlaylist: async (id: string) => {
    const token = useAuth.getState().token;
    if (!token) throw new Error('Not authenticated');

    // Optimistic update FIRST
    const { playlists } = get();
    set({ playlists: playlists.filter((p) => p.id !== id) });

    const response = await fetch(`${API_URL}/playlists/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) {
      // Rollback on error
      set({ playlists });
      throw new Error('Failed to delete playlist');
    }
  },

  setCurrentPlaylist: (playlist: Playlist | null) => {
    set({ currentPlaylist: playlist });
  }
}));

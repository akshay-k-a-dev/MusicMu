// Use backend proxy to bypass CORS
const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) {
    return `${import.meta.env.VITE_API_URL}/api`;
  }
  return '/api';
};

const API_BASE = getApiBase();

export interface LyricsData {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  instrumental: boolean;
  plainLyrics: string | null;
  syncedLyrics: string | null;
}

export interface SyncedLine {
  time: number;
  text: string;
}

/**
 * Parse synced lyrics format [mm:ss.xx] text
 */
export function parseSyncedLyrics(syncedLyrics: string): SyncedLine[] {
  const lines = syncedLyrics.split('\n').filter(line => line.trim());
  const parsed: SyncedLine[] = [];

  for (const line of lines) {
    const match = line.match(/\[(\d+):(\d+)\.(\d+)\]\s*(.*)$/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const centiseconds = parseInt(match[3], 10);
      const time = minutes * 60 + seconds + centiseconds / 100;
      const text = match[4];
      parsed.push({ time, text });
    }
  }

  return parsed.sort((a, b) => a.time - b.time);
}

/**
 * Extract potential song name and artist from YouTube title
 * YouTube titles often have formats like:
 * - "Artist - Song Name"
 * - "Song Name - Artist"
 * - "Artist - Song Name (Official Video)"
 * - "Song Name ft. Artist2 - Artist1"
 */
function extractTitleCombinations(title: string): { track: string; artist: string }[] {
  const combinations: { track: string; artist: string }[] = [];
  
  // Clean the title - remove common suffixes and features
  let cleanTitle = title
    .replace(/\(Official.*?\)/gi, '')
    .replace(/\(Audio.*?\)/gi, '')
    .replace(/\(Lyric.*?\)/gi, '')
    .replace(/\(Music.*?\)/gi, '')
    .replace(/\(HD.*?\)/gi, '')
    .replace(/\(HQ.*?\)/gi, '')
    .replace(/\(4K.*?\)/gi, '')
    .replace(/\(Video.*?\)/gi, '')
    .replace(/\[Official.*?\]/gi, '')
    .replace(/\[Audio.*?\]/gi, '')
    .replace(/\[Lyric.*?\]/gi, '')
    .replace(/\[HD.*?\]/gi, '')
    .replace(/Official Video/gi, '')
    .replace(/Official Audio/gi, '')
    .replace(/Lyrics/gi, '')
    .replace(/\s+HD\s*/gi, ' ')
    .replace(/\s+HQ\s*/gi, ' ')
    .replace(/\s+4K\s*/gi, ' ')
    .replace(/\s*ft\.?\s+[^-|]+$/gi, '') // Remove "ft. Someone" at the end
    .replace(/\s*feat\.?\s+[^-|]+$/gi, '') // Remove "feat. Someone" at the end
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  // Try splitting by " - "
  if (cleanTitle.includes(' - ')) {
    const parts = cleanTitle.split(' - ').map(p => p.trim()).filter(p => p);
    if (parts.length >= 2) {
      // Also clean ft/feat from track parts
      const cleanTrack = (s: string) => s
        .replace(/\s*ft\.?\s+.*$/gi, '')
        .replace(/\s*feat\.?\s+.*$/gi, '')
        .trim();
      
      // Artist - Song (most common for YouTube)
      combinations.push({ track: cleanTrack(parts[1]), artist: parts[0] });
      // Song - Artist
      combinations.push({ track: cleanTrack(parts[0]), artist: parts[1] });
    }
  }
  
  // Try splitting by " | "
  if (cleanTitle.includes(' | ')) {
    const parts = cleanTitle.split(' | ').map(p => p.trim()).filter(p => p);
    if (parts.length >= 2) {
      combinations.push({ track: parts[0], artist: parts[1] });
      combinations.push({ track: parts[1], artist: parts[0] });
    }
  }
  
  // Just use the clean title as track name
  combinations.push({ track: cleanTitle, artist: '' });
  
  return combinations;
}

/**
 * Get lyrics from LRCLIB API using search endpoint
 * Uses sequential requests with reasonable timeouts
 */
export async function getLyrics(
  trackName: string,
  artistName: string,
  duration: number
): Promise<LyricsData | null> {
  const targetDuration = Math.round(duration);
  
  // Helper to search with timeout
  async function searchLyricsApi(track: string, artist: string, timeout: number = 8000): Promise<LyricsData | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const searchParams = new URLSearchParams({
        track_name: track,
        artist_name: artist,
      });

      const response = await fetch(`${API_BASE}/lyrics?${searchParams.toString()}`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) return null;

      const results: LyricsData[] = await response.json();
      
      if (!results || results.length === 0) return null;

      // Find best match by duration (within 20 seconds for flexibility)
      const bestMatch = results.find((r) => 
        Math.abs(r.duration - targetDuration) <= 20
      ) || results[0];
      
      // Return if it has any lyrics (synced or plain)
      if (bestMatch && (bestMatch.syncedLyrics || bestMatch.plainLyrics)) {
        return bestMatch;
      }
      return null;
    } catch (error) {
      clearTimeout(timeoutId);
      // Log timeout for debugging but don't fail
      console.warn('Lyrics fetch timeout/error for:', track);
      return null;
    }
  }
  
  // Extract cleaned title combinations first (more likely to match)
  const combinations = extractTitleCombinations(trackName);
  console.log('📝 Lyrics search combinations:', combinations.slice(0, 2));
  
  // Try 1: First cleaned combination (Artist - Song format extracted)
  if (combinations.length > 0) {
    const firstCombo = combinations[0];
    const artist = firstCombo.artist || artistName;
    console.log('📝 Try 1:', firstCombo.track, 'by', artist);
    let result = await searchLyricsApi(firstCombo.track, artist, 8000);
    if (result) return result;
  }
  
  // Try 2: Second combination (Song - Artist format)
  if (combinations.length > 1) {
    const secondCombo = combinations[1];
    const artist = secondCombo.artist || artistName;
    console.log('📝 Try 2:', secondCombo.track, 'by', artist);
    let result = await searchLyricsApi(secondCombo.track, artist, 6000);
    if (result) return result;
  }
  
  // Try 3: Original track name with artist (fallback for already clean titles)
  console.log('📝 Try 3 (fallback):', trackName, 'by', artistName);
  let result = await searchLyricsApi(trackName, artistName, 5000);
  if (result) return result;
  
  return null;
}

/**
 * Search for lyrics by query string
 */
export async function searchLyrics(query: string): Promise<LyricsData[]> {
  try {
    const params = new URLSearchParams({ q: query });
    const response = await fetch(`${API_BASE}/lyrics?${params.toString()}`);

    if (!response.ok) {
      throw new Error(`Failed to search lyrics: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error searching lyrics:', error);
    return [];
  }
}

/**
 * Get current line index based on playback time
 */
export function getCurrentLineIndex(lines: SyncedLine[], currentTime: number): number {
  if (lines.length === 0) return -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    if (currentTime >= lines[i].time) {
      return i;
    }
  }

  return -1;
}

/**
 * Fun messages when lyrics are not available
 */
export const noLyricsMessages = [
  "🎤 You caught us! We don't have lyrics for this one.",
  "🎵 Time to guess the lyrics yourself!",
  "🎶 This one's a mystery - no lyrics here!",
  "🎸 La la la... (we don't have the lyrics)",
  "🎹 Instrumental vibes only (or we just don't have it)",
  "🎧 No lyrics? More room for imagination!",
  "🎼 The lyrics are playing hide and seek!",
  "🎪 Sing whatever you want - no lyrics to judge you!",
];

export const noSyncedLyricsMessage = "⏱️ Hmm, this song doesn't have synced lyrics yet, but here's the plain text!";

export function getRandomNoLyricsMessage(): string {
  return noLyricsMessages[Math.floor(Math.random() * noLyricsMessages.length)];
}

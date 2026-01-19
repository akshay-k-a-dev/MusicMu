import { useEffect, useState, useRef, useMemo, useCallback, memo } from 'react';
import { Loader2, Music2, AlignLeft, Clock } from 'lucide-react';
import { getLyrics, getCurrentLineIndex, getRandomNoLyricsMessage, noSyncedLyricsMessage, SyncedLine } from '../services/lyrics';
import { useLyricsStore } from '../lib/lyricsStore';

interface LyricsPanelProps {
  trackTitle: string;
  artistName: string;
  duration: number;
  currentTime: number;
  trackId?: string;
}

// Individual lyric line component
const LyricLine = memo(({ 
  line, 
  isCurrent, 
  isPast,
  distanceFromCurrent,
  onRef,
}: { 
  line: SyncedLine; 
  isCurrent: boolean; 
  isPast: boolean;
  distanceFromCurrent: number;
  onRef?: (el: HTMLDivElement | null) => void;
}) => {
  const opacity = isCurrent ? 1 : Math.max(0.25, 1 - Math.abs(distanceFromCurrent) * 0.2);
  
  return (
    <div
      ref={onRef}
      className={`text-center py-4 px-4 transition-all duration-500 ease-out ${
        isCurrent
          ? 'text-white text-xl sm:text-2xl md:text-3xl font-bold scale-100'
          : 'text-white font-normal text-base sm:text-lg md:text-xl'
      }`}
      style={{ opacity }}
    >
      {line.text || '♪'}
    </div>
  );
});

LyricLine.displayName = 'LyricLine';

export function LyricsPanel({ trackTitle, artistName, duration, currentTime, trackId }: LyricsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'synced' | 'plain'>('synced');
  const [noLyricsMessage] = useState(getRandomNoLyricsMessage());
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const currentLineRef = useRef<HTMLDivElement | null>(null);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Zustand store for caching
  const { getCached, setLyrics, setCurrentTrack } = useLyricsStore();
  
  // Create a cache key from track info
  const cacheKey = useMemo(() => 
    trackId || `${trackTitle}-${artistName}`, 
    [trackId, trackTitle, artistName]
  );
  
  // Get cached data
  const cachedEntry = getCached(cacheKey);
  const lyrics = cachedEntry?.lyrics ?? null;
  const syncedLines = cachedEntry?.syncedLines ?? [];

  // Fetch lyrics when track changes (only if not cached with actual lyrics)
  useEffect(() => {
    let mounted = true;

    async function fetchLyrics() {
      if (!trackTitle || !artistName || !duration || duration <= 0) {
        return;
      }

      // Check cache first - but only use if it has actual lyrics
      const cached = getCached(cacheKey);
      if (cached && cached.lyrics && (cached.lyrics.syncedLyrics || cached.lyrics.plainLyrics)) {
        console.log('📝 Using cached lyrics for:', trackTitle);
        setCurrentTrack(cacheKey);
        if (cached.syncedLines.length > 0) {
          setViewMode('synced');
        } else if (cached.lyrics?.plainLyrics) {
          setViewMode('plain');
        }
        setLoading(false);
        return;
      }

      // If cached but no lyrics found, clear it and try again
      if (cached && !cached.lyrics) {
        console.log('📝 Cached entry has no lyrics, re-fetching:', trackTitle);
      }

      setLoading(true);
      setCurrentLineIndex(0);

      console.log('📝 Fetching lyrics for:', trackTitle, 'by', artistName);
      const result = await getLyrics(trackTitle, artistName, duration);
      
      if (mounted) {
        // Only cache if we got a result with lyrics
        if (result && (result.syncedLyrics || result.plainLyrics)) {
          console.log('📝 Found lyrics:', result.syncedLyrics ? 'synced' : 'plain only');
          setLyrics(cacheKey, result);
        } else {
          console.log('📝 No lyrics found for:', trackTitle);
          // Don't cache null results - allow retry next time
          setLyrics(cacheKey, null);
        }
        
        setCurrentTrack(cacheKey);
        
        if (result?.syncedLyrics) {
          setViewMode('synced');
        } else if (result?.plainLyrics) {
          setViewMode('plain');
        }
        setLoading(false);
      }
    }

    fetchLyrics();

    return () => {
      mounted = false;
    };
  }, [cacheKey, trackTitle, artistName, duration, getCached, setLyrics, setCurrentTrack]);

  // Update current line based on playback time
  useEffect(() => {
    if (syncedLines.length > 0 && viewMode === 'synced') {
      const index = getCurrentLineIndex(syncedLines, currentTime);
      setCurrentLineIndex(index >= 0 ? index : 0);
    }
  }, [syncedLines, currentTime, viewMode]);

  // Handle user scroll - temporarily disable auto-scroll
  const handleUserScroll = useCallback(() => {
    // Clear any existing timeout
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }
    
    // Disable auto-scroll
    setIsAutoScrollEnabled(false);
    
    // Re-enable after 3 seconds of no scrolling
    userScrollTimeoutRef.current = setTimeout(() => {
      setIsAutoScrollEnabled(true);
    }, 3000);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  // Auto-scroll to center current line
  useEffect(() => {
    if (!isAutoScrollEnabled || !currentLineRef.current || !containerRef.current) return;
    
    const container = containerRef.current;
    const line = currentLineRef.current;
    
    // Calculate scroll position to center the current line
    const containerHeight = container.clientHeight;
    const lineTop = line.offsetTop;
    const lineHeight = line.offsetHeight;
    const scrollTarget = lineTop - (containerHeight / 2) + (lineHeight / 2);
    
    container.scrollTo({
      top: Math.max(0, scrollTarget),
      behavior: 'smooth'
    });
  }, [currentLineIndex, isAutoScrollEnabled]);

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-white/60">
        <Loader2 size={32} className="animate-spin mb-4" />
        <p className="text-sm">Loading lyrics...</p>
      </div>
    );
  }

  // No lyrics found
  if (!lyrics || (lyrics.instrumental && !lyrics.plainLyrics && !lyrics.syncedLyrics)) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 text-white/60 px-4 text-center">
        <Music2 size={48} className="mb-4 text-white/40" />
        <p className="text-base sm:text-lg font-medium mb-2">{noLyricsMessage}</p>
        <p className="text-xs sm:text-sm text-white/40">
          {lyrics?.instrumental ? 'This track is marked as instrumental' : 'Try another track!'}
        </p>
      </div>
    );
  }

  // Has plain lyrics but no synced (or synced couldn't be parsed)
  if ((!lyrics.syncedLyrics || syncedLines.length === 0) && lyrics.plainLyrics) {
    return (
      <div className="h-full overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-6 text-yellow-400/80 text-xs sm:text-sm">
            <AlignLeft size={16} />
            <p>{noSyncedLyricsMessage}</p>
          </div>
          <div className="whitespace-pre-wrap text-white/80 text-sm sm:text-base leading-relaxed">
            {lyrics.plainLyrics}
          </div>
        </div>
      </div>
    );
  }

  // Has synced lyrics
  if (lyrics.syncedLyrics && syncedLines.length > 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-black/50">
        {/* View Mode Toggle */}
        {lyrics.plainLyrics && (
          <div className="flex items-center justify-center gap-2 py-3 border-b border-white/10 flex-shrink-0">
            <button
              onClick={() => setViewMode('synced')}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'synced'
                  ? 'bg-white/20 text-white'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              <Clock size={14} />
              Synced
            </button>
            <button
              onClick={() => setViewMode('plain')}
              className={`px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
                viewMode === 'plain'
                  ? 'bg-white/20 text-white'
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              <AlignLeft size={14} />
              Plain
            </button>
          </div>
        )}

        {/* Lyrics Content */}
        {viewMode === 'synced' ? (
          <div 
            ref={containerRef}
            className="flex-1 relative overflow-y-auto overflow-x-hidden"
            onScroll={handleUserScroll}
            onTouchMove={handleUserScroll}
          >
            {/* Top fade gradient */}
            <div className="sticky top-0 left-0 right-0 h-24 bg-gradient-to-b from-black via-black/80 to-transparent z-10 pointer-events-none" />
            
            {/* Lyrics with vertical padding for centering */}
            <div 
              className="max-w-2xl mx-auto relative"
              style={{ 
                paddingTop: 'calc(50vh - 80px)',
                paddingBottom: 'calc(50vh - 80px)',
                marginTop: '-96px', // Offset the sticky gradient
              }}
            >
              {syncedLines.map((line, index) => (
                <LyricLine
                  key={index}
                  line={line}
                  isCurrent={index === currentLineIndex}
                  isPast={index < currentLineIndex}
                  distanceFromCurrent={index - currentLineIndex}
                  onRef={index === currentLineIndex ? (el) => { currentLineRef.current = el; } : undefined}
                />
              ))}
            </div>
            
            {/* Bottom fade gradient */}
            <div className="sticky bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black via-black/80 to-transparent z-10 pointer-events-none" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
            <div className="max-w-2xl mx-auto whitespace-pre-wrap text-white/80 text-sm sm:text-base leading-relaxed">
              {lyrics.plainLyrics}
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

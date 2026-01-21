import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Volume1,
  Heart, ListMusic, Share2, ChevronDown, MoreHorizontal, Plus, Music2, FileText
} from 'lucide-react';
import { usePlayer } from '../services/player';
import { useNavigate } from 'react-router-dom';
import { AddToPlaylistDropdown } from './AddToPlaylistDropdown';
import { LyricsPanel } from './LyricsPanel';

// Global state for full-screen player visibility
let fullScreenListeners: Set<(val: boolean) => void> = new Set();
let isFullScreenGlobal = false;

export function openFullScreenPlayer() {
  isFullScreenGlobal = true;
  fullScreenListeners.forEach(fn => fn(true));
}

export function closeFullScreenPlayer() {
  isFullScreenGlobal = false;
  fullScreenListeners.forEach(fn => fn(false));
}

// Format time helper
function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function PlayerBar() {
  const {
    currentTrack,
    state,
    progress,
    duration,
    volume,
    togglePlay,
    seek,
    setVolume,
    next,
    prev,
    like,
    unlike,
    isLiked,
  } = usePlayer();

  const navigate = useNavigate();
  const [isFullScreen, setIsFullScreen] = useState(isFullScreenGlobal);
  const [showOverflow, setShowOverflow] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [trackIsLiked, setTrackIsLiked] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [prevVolume, setPrevVolume] = useState(1);
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  const isPlaying = state === 'playing';

  // Check if track is liked
  useEffect(() => {
    if (currentTrack) {
      setTrackIsLiked(isLiked(currentTrack.videoId));
    }
  }, [currentTrack, isLiked]);

  // Subscribe to global full-screen state
  useEffect(() => {
    const handler = (val: boolean) => setIsFullScreen(val);
    fullScreenListeners.add(handler);
    return () => { fullScreenListeners.delete(handler); };
  }, []);

  // Handle progress bar seek - support both mouse and touch
  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!progressRef.current || !duration) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    let x: number;
    
    // Handle both mouse and touch events
    if ('touches' in e) {
      // Touch event
      x = e.touches[0].clientX - rect.left;
    } else {
      // Mouse event
      x = e.clientX - rect.left;
    }
    
    const percent = Math.max(0, Math.min(1, x / rect.width));
    seek(percent * duration);
  }, [duration, seek]);

  // Handle volume change
  const handleVolumeChange = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!volumeRef.current) return;
    const rect = volumeRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    setVolume(percent);
    if (percent > 0) setIsMuted(false);
  }, [setVolume]);

  const handleToggleMute = () => {
    if (isMuted) {
      setVolume(prevVolume);
      setIsMuted(false);
    } else {
      setPrevVolume(volume);
      setVolume(0);
      setIsMuted(true);
    }
  };

  const handleClose = () => {
    closeFullScreenPlayer();
  };

  const handleOpenFull = () => {
    openFullScreenPlayer();
  };

  const handleToggleLike = async () => {
    if (!currentTrack) return;
    if (trackIsLiked) {
      await unlike(currentTrack.videoId);
      setTrackIsLiked(false);
    } else {
      await like(currentTrack);
      setTrackIsLiked(true);
    }
  };

  const openQueue = () => {
    navigate('/queue');
    closeFullScreenPlayer();
  };

  const handleShare = async () => {
    if (!currentTrack) return;
    
    // Get the app's domain from window.location
    const appDomain = window.location.origin;
    const shareUrl = `${appDomain}/track/${currentTrack.videoId}`;
    
    const shareData = {
      title: currentTrack.title,
      text: `Check out "${currentTrack.title}" by ${currentTrack.artist} on Cantio`,
      url: shareUrl
    };
    
    try {
      // Check if Web Share API is supported
      if (navigator.share) {
        await navigator.share(shareData);
        console.log('✅ Track shared successfully');
      } else {
        // Fallback: Copy to clipboard
        const textToCopy = `${shareData.text}\n${shareData.url}`;
        await navigator.clipboard.writeText(textToCopy);
        
        // Show a temporary success message (you can add a toast notification here)
        console.log('✅ Link copied to clipboard');
        alert('Link copied to clipboard!');
      }
    } catch (error) {
      // User cancelled or error occurred
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('❌ Share failed:', error);
      }
    }
  };

  const progressPercent = duration > 0 ? (progress / duration) * 100 : 0;

  // Empty state - no track
  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 hidden md:block">
        <div className="bg-black/80 backdrop-blur-xl border-t border-white/5 h-20 flex items-center justify-center">
          <div className="flex items-center gap-3 text-white/40">
            <Music2 size={20} />
            <span className="text-sm">Select a track to play</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* DESKTOP LYRICS PANEL - Slides up from player bar */}
      <AnimatePresence>
        {showLyrics && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-[88px] left-0 right-0 z-40 hidden md:block"
          >
            <div className="bg-gradient-to-t from-black via-black/95 to-black/90 backdrop-blur-xl border-t border-white/10 h-[400px] overflow-hidden">
              {/* Close button */}
              <button
                onClick={() => setShowLyrics(false)}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition z-10"
              >
                <ChevronDown size={20} className="text-white" />
              </button>
              
              {/* Track info header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center gap-4">
                <img
                  src={currentTrack.thumbnail}
                  alt={currentTrack.title}
                  className="w-12 h-12 rounded-lg object-cover"
                />
                <div>
                  <h3 className="text-white font-semibold">{currentTrack.title}</h3>
                  <p className="text-white/60 text-sm">{currentTrack.artist}</p>
                </div>
              </div>
              
              {/* Lyrics content */}
              <div className="h-[calc(100%-80px)]">
                <LyricsPanel
                  trackTitle={currentTrack.title}
                  artistName={currentTrack.artist}
                  duration={duration}
                  currentTime={progress}
                  trackId={currentTrack.videoId}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESKTOP PLAYER BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 hidden md:block">
        <div className="bg-black/80 backdrop-blur-xl border-t border-white/5">
          {/* Progress bar at very top */}
          <div
            ref={progressRef}
            className="h-1 w-full bg-white/10 cursor-pointer group"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-green-500 group-hover:bg-green-400 relative transition-colors"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="h-[72px] px-4 flex items-center justify-between">
            {/* LEFT: Track Info */}
            <div className="flex items-center gap-3 w-[280px] min-w-0">
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-white text-sm font-medium truncate">{currentTrack.title}</p>
                <p className="text-white/50 text-xs truncate">{currentTrack.artist}</p>
              </div>
              <button
                onClick={handleToggleLike}
                className={`p-2 rounded-full hover:bg-white/10 transition flex-shrink-0 ${trackIsLiked ? 'text-green-500' : 'text-white/60'}`}
              >
                <Heart size={18} fill={trackIsLiked ? 'currentColor' : 'none'} />
              </button>
              <AddToPlaylistDropdown
                track={{
                  videoId: currentTrack.videoId,
                  title: currentTrack.title,
                  artist: currentTrack.artist,
                  thumbnail: currentTrack.thumbnail,
                  duration: currentTrack.duration
                }}
                onAddToQueue={() => {}}
              />
            </div>

            {/* CENTER: Controls */}
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-4">
                <button
                  onClick={prev}
                  className="p-2 text-white/60 hover:text-white transition"
                >
                  <SkipBack size={22} fill="currentColor" />
                </button>
                <button
                  onClick={togglePlay}
                  className="w-10 h-10 bg-white rounded-full flex items-center justify-center hover:scale-105 transition"
                >
                  {isPlaying ? (
                    <Pause size={20} className="text-black" fill="black" />
                  ) : (
                    <Play size={20} className="text-black ml-0.5" fill="black" />
                  )}
                </button>
                <button
                  onClick={next}
                  className="p-2 text-white/60 hover:text-white transition"
                >
                  <SkipForward size={22} fill="currentColor" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-white/40">
                <span>{formatTime(progress)}</span>
                <span>/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* RIGHT: Lyrics + Volume + Queue */}
            <div className="flex items-center gap-3 w-[280px] justify-end">
              {/* Lyrics Toggle */}
              <button
                onClick={() => setShowLyrics(!showLyrics)}
                className={`p-2 transition rounded-full hover:bg-white/10 ${showLyrics ? 'text-green-500' : 'text-white/60 hover:text-white'}`}
                title={showLyrics ? 'Hide lyrics' : 'Show lyrics'}
              >
                <FileText size={18} />
              </button>
              <button
                onClick={handleShare}
                className="p-2 text-white/60 hover:text-white transition rounded-full hover:bg-white/10"
                title="Share track"
              >
                <Share2 size={18} />
              </button>
              <button
                onClick={openQueue}
                className="p-2 text-white/60 hover:text-white transition rounded-full hover:bg-white/10"
              >
                <ListMusic size={18} />
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleMute}
                  className="p-1 text-white/60 hover:text-white transition"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX size={18} />
                  ) : volume < 0.5 ? (
                    <Volume1 size={18} />
                  ) : (
                    <Volume2 size={18} />
                  )}
                </button>
                <div
                  ref={volumeRef}
                  className="w-24 h-1 bg-white/20 rounded-full cursor-pointer group"
                  onClick={handleVolumeChange}
                >
                  <div
                    className="h-full bg-white/70 group-hover:bg-green-500 rounded-full relative transition-colors"
                    style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MOBILE MINI PLAYER - sits above the nav bar */}
      <AnimatePresence>
        {!isFullScreen && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-14 left-0 right-0 z-30 md:hidden"
          >
            {/* Progress bar */}
            <div className="h-0.5 w-full bg-white/10">
              <div className="h-full bg-green-500" style={{ width: `${progressPercent}%` }} />
            </div>

            <div
              className="bg-zinc-900/95 backdrop-blur-xl px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 sm:gap-3"
              onClick={handleOpenFull}
            >
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="w-11 sm:w-12 h-11 sm:h-12 rounded-md sm:rounded-lg object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs sm:text-sm font-medium truncate">{currentTrack.title}</p>
                <p className="text-white/50 text-[10px] sm:text-xs truncate">{currentTrack.artist}</p>
              </div>
              <div onClick={(e) => e.stopPropagation()}>
                <AddToPlaylistDropdown
                  track={{
                    videoId: currentTrack.videoId,
                    title: currentTrack.title,
                    artist: currentTrack.artist,
                    thumbnail: currentTrack.thumbnail,
                    duration: currentTrack.duration
                  }}
                  onAddToQueue={() => {}}
                />
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="w-10 sm:w-11 h-10 sm:h-11 bg-white rounded-full flex items-center justify-center flex-shrink-0"
              >
                {isPlaying ? (
                  <>
                    <Pause size={20} className="sm:hidden text-black" fill="black" />
                    <Pause size={22} className="hidden sm:block text-black" fill="black" />
                  </>
                ) : (
                  <>
                    <Play size={20} className="sm:hidden text-black ml-0.5" fill="black" />
                    <Play size={22} className="hidden sm:block text-black ml-0.5" fill="black" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULL SCREEN MOBILE PLAYER */}
      <AnimatePresence>
        {isFullScreen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[999] md:hidden flex flex-col"
            style={{
              background: `linear-gradient(180deg, rgba(30, 30, 30, 0.98) 0%, rgba(10, 10, 10, 0.99) 100%)`,
            }}
          >
            {/* Background blur with album art */}
            <div
              className="absolute inset-0 opacity-30 blur-3xl scale-110"
              style={{
                backgroundImage: `url(${currentTrack.thumbnail})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />

            {/* Content overlay */}
            <div className="relative z-10 flex flex-col h-full">
              {/* Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 pt-safe">
                <button
                  onClick={handleClose}
                  className="p-1.5 sm:p-2 -ml-1 sm:-ml-2 text-white/70 hover:text-white active:scale-95 transition"
                >
                  <ChevronDown size={24} className="sm:hidden" />
                  <ChevronDown size={28} className="hidden sm:block" />
                </button>
                <div className="text-center flex-1">
                  <p className="text-white/50 text-[10px] sm:text-xs uppercase tracking-wider">Playing from</p>
                  <p className="text-white text-xs sm:text-sm font-medium">Your Library</p>
                </div>
                <button
                  onClick={() => setShowLyrics(!showLyrics)}
                  className={`p-1.5 sm:p-2 -mr-1 sm:-mr-2 active:scale-95 transition ${showLyrics ? 'text-white' : 'text-white/70 hover:text-white'}`}
                  title="Toggle lyrics"
                >
                  <FileText size={20} className="sm:hidden" />
                  <FileText size={24} className="hidden sm:block" />
                </button>
              </div>

              {/* Album Art / Lyrics */}
              <div className="flex-1 flex items-center justify-center px-4 sm:px-6 md:px-8 py-4 sm:py-6 overflow-hidden">
                {!showLyrics ? (
                  <motion.img
                    key={currentTrack.videoId}
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    src={currentTrack.thumbnail}
                    alt={currentTrack.title}
                    className="w-full max-w-[280px] sm:max-w-[320px] md:max-w-[340px] aspect-square rounded-lg sm:rounded-xl object-cover shadow-2xl"
                  />
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="w-full h-full max-w-2xl"
                  >
                    <LyricsPanel
                      trackTitle={currentTrack.title}
                      artistName={currentTrack.artist}
                      duration={duration}
                      currentTime={progress}
                    />
                  </motion.div>
                )}
              </div>

              {/* Track Info + Like */}
              <div className="px-4 sm:px-6 md:px-8 flex items-start justify-between">
                <div className="min-w-0 flex-1 mr-2 sm:mr-4">
                  <h2 className="text-white text-lg sm:text-xl font-bold truncate">{currentTrack.title}</h2>
                  <p className="text-white/60 text-sm sm:text-base mt-0.5 sm:mt-1 truncate">{currentTrack.artist}</p>
                </div>
                <button
                  onClick={handleToggleLike}
                  className={`p-1.5 sm:p-2 -mr-1.5 sm:-mr-2 transition active:scale-95 flex-shrink-0 ${trackIsLiked ? 'text-green-500' : 'text-white/50'}`}
                >
                  <Heart size={22} className="sm:hidden" fill={trackIsLiked ? 'currentColor' : 'none'} />
                  <Heart size={26} className="hidden sm:block" fill={trackIsLiked ? 'currentColor' : 'none'} />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="px-4 sm:px-6 md:px-8 mt-4 sm:mt-6">
                <div
                  ref={progressRef}
                  className="h-1 w-full bg-white/20 rounded-full cursor-pointer active:h-1.5 transition-all"
                  onClick={handleSeek}
                  onTouchStart={handleSeek}
                >
                  <div
                    className="h-full bg-white rounded-full relative"
                    style={{ width: `${progressPercent}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 sm:w-3.5 h-3 sm:h-3.5 bg-white rounded-full shadow" />
                  </div>
                </div>
                <div className="flex justify-between mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-white/50">
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Main Controls */}
              <div className="flex items-center justify-center gap-6 sm:gap-8 px-4 sm:px-8 mt-4 sm:mt-6">
                <button
                  onClick={prev}
                  className="p-2 sm:p-3 text-white active:scale-95 transition"
                >
                  <SkipBack size={28} className="sm:hidden" fill="currentColor" />
                  <SkipBack size={32} className="hidden sm:block" fill="currentColor" />
                </button>
                <button
                  onClick={togglePlay}
                  className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center active:scale-95 transition shadow-lg"
                >
                  {isPlaying ? (
                    <>
                      <Pause size={28} className="sm:hidden text-black" fill="black" />
                      <Pause size={32} className="hidden sm:block text-black" fill="black" />
                    </>
                  ) : (
                    <>
                      <Play size={28} className="sm:hidden text-black ml-0.5" fill="black" />
                      <Play size={32} className="hidden sm:block text-black ml-0.5" fill="black" />
                    </>
                  )}
                </button>
                <button
                  onClick={next}
                  className="p-2 sm:p-3 text-white active:scale-95 transition"
                >
                  <SkipForward size={28} className="sm:hidden" fill="currentColor" />
                  <SkipForward size={32} className="hidden sm:block" fill="currentColor" />
                </button>
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between px-4 sm:px-6 md:px-8 mt-6 sm:mt-8 mb-6 sm:mb-8 pb-safe relative">
                <div className="relative">
                  <AddToPlaylistDropdown
                    track={{
                      videoId: currentTrack.videoId,
                      title: currentTrack.title,
                      artist: currentTrack.artist,
                      thumbnail: currentTrack.thumbnail,
                      duration: currentTrack.duration
                    }}
                    onAddToQueue={() => {}}
                  />
                </div>
                <button 
                  onClick={handleShare}
                  className="p-2 sm:p-3 text-white/50 hover:text-white active:scale-95 transition"
                >
                  <Share2 size={20} className="sm:hidden" />
                  <Share2 size={22} className="hidden sm:block" />
                </button>
                <button
                  onClick={openQueue}
                  className="p-2 sm:p-3 text-white/50 active:scale-95 transition"
                >
                  <ListMusic size={20} className="sm:hidden" />
                  <ListMusic size={22} className="hidden sm:block" />
                </button>
              </div>
            </div>

            {/* Overflow Menu */}
            <AnimatePresence>
              {showOverflow && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 z-20"
                    onClick={() => setShowOverflow(false)}
                  />
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                    className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-2xl z-30 pb-safe"
                  >
                    <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mt-3" />
                    <div className="p-4 space-y-2">
                      <div className="relative">
                        <AddToPlaylistDropdown
                          track={{
                            videoId: currentTrack.videoId,
                            title: currentTrack.title,
                            artist: currentTrack.artist,
                            thumbnail: currentTrack.thumbnail,
                            duration: currentTrack.duration
                          }}
                          onAddToQueue={() => {}}
                        />
                      </div>
                      <button 
                        onClick={() => {
                          setShowOverflow(false);
                          handleShare();
                        }}
                        className="flex items-center gap-4 w-full p-4 hover:bg-white/5 rounded-xl transition"
                      >
                        <Share2 size={22} className="text-white/70" />
                        <span className="text-white">Share</span>
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

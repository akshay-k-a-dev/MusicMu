import { motion } from 'framer-motion';
import { Play, Pause, Music, Loader2, RefreshCw } from 'lucide-react';
import { usePlayer } from '../services/player';
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/authStore';
import { getRecommendations, getGuestRecommendations, Recommendations } from '../services/recommendations';
import RecommendationSection from '../components/RecommendationSection';
import ArtistCard from '../components/ArtistCard';

export function HomePage() {
  const { currentTrack, state, togglePlay } = usePlayer();
  const { isAuthenticated } = useAuth();
  const [recommendations, setRecommendations] = useState<Recommendations | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (isAuthenticated) {
        const data = await getRecommendations();
        setRecommendations(data);
      } else {
        const data = await getGuestRecommendations();
        setRecommendations(data);
      }
    } catch (err) {
      console.error('Failed to load recommendations:', err);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecommendations();
  }, [isAuthenticated]);

  if (!currentTrack) {
    return (
      <div className="space-y-8">
        <div className="flex flex-col items-center justify-center min-h-[40vh]">
          <Music size={80} className="text-purple-700 mb-6" />
          <h2 className="text-3xl font-bold text-gray-300 mb-4">
            Welcome to MusicMu
          </h2>
          <p className="text-gray-400 text-center max-w-md mb-2">
            Ad-free music streaming with unlimited skips
          </p>
          <p className="text-sm text-gray-500 text-center max-w-md">
            Search for songs to start listening — no interruptions, no forced content
          </p>
        </div>

        {/* Show recommendations even when no track is playing */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="text-purple-500 animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={loadRecommendations}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && recommendations && (
          <div className="space-y-8">
            {/* Recently Played */}
            {recommendations.recentlyPlayed.length > 0 && (
              <RecommendationSection
                title="Recently Played"
                description="Pick up where you left off"
                tracks={recommendations.recentlyPlayed}
              />
            )}

            {/* Most Played */}
            {recommendations.mostPlayed.length > 0 && (
              <RecommendationSection
                title="Your Favorites"
                description="Tracks you can't get enough of"
                tracks={recommendations.mostPlayed}
              />
            )}

            {/* Top Artists */}
            {recommendations.topArtists.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-white">Top Artists</h2>
                    <p className="text-sm text-gray-400 mt-1">Artists you love most</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {recommendations.topArtists.map((artist, index) => (
                    <ArtistCard key={artist.name} artist={artist} index={index} />
                  ))}
                </div>
              </div>
            )}

            {recommendations.recentlyPlayed && recommendations.recentlyPlayed.length === 0 && 
             recommendations.mostPlayed && recommendations.mostPlayed.length === 0 && 
             recommendations.topArtists && recommendations.topArtists.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p>Start listening to build your recommendations!</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Hero Section with Album Art */}
      <div className="flex items-end gap-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-64 h-64 flex-shrink-0 group"
        >
          <img
            src={currentTrack.thumbnail}
            alt={currentTrack.title}
            className="w-full h-full object-cover rounded shadow-2xl"
          />
          <motion.div
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            className="absolute inset-0 bg-black/40 flex items-center justify-center rounded"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-2xl hover:bg-green-400 transition-colors"
              disabled={state === 'loading'}
            >
              {state === 'loading' ? (
                <Loader2 size={28} className="text-black animate-spin" />
              ) : state === 'playing' ? (
                <Pause size={28} fill="black" className="text-black" />
              ) : (
                <Play size={28} fill="black" className="text-black ml-1" />
              )}
            </motion.button>
          </motion.div>
        </motion.div>

        <div className="flex-1 pb-4">
          <p className="text-sm font-semibold uppercase text-gray-400 mb-2">
            Now Playing
          </p>
          <motion.h1
            key={currentTrack.videoId}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl font-black mb-6 line-clamp-2"
          >
            {currentTrack.title}
          </motion.h1>
          <p className="text-xl text-gray-300">{currentTrack.artist}</p>
        </div>
      </div>

      {/* Quick Info */}
      <div className="flex items-center gap-8 text-sm text-gray-400">
        <div>
          <span className="font-semibold text-white">Duration: </span>
          {Math.floor(currentTrack.duration / 60)}:
          {(currentTrack.duration % 60).toString().padStart(2, '0')}
        </div>
        <div>
          <span className="font-semibold text-white">Format: </span>
          Audio-Only Stream
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-gray-800 my-8"></div>

      {/* Recommendations Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">For You</h2>
          <button
            onClick={loadRecommendations}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={32} className="text-purple-500 animate-spin" />
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={loadRecommendations}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && recommendations && (
          <div className="space-y-8">
            {/* Recently Played */}
            {recommendations.recentlyPlayed.length > 0 && (
              <RecommendationSection
                title="Recently Played"
                description="Pick up where you left off"
                tracks={recommendations.recentlyPlayed}
              />
            )}

            {/* Most Played */}
            {recommendations.mostPlayed.length > 0 && (
              <RecommendationSection
                title="Your Favorites"
                description="Tracks you can't get enough of"
                tracks={recommendations.mostPlayed}
              />
            )}

            {/* Top Artists */}
            {recommendations.topArtists.length > 0 && (
              <div className="mb-8">
                <div className="mb-4">
                  <h3 className="text-xl font-bold text-white">Top Artists</h3>
                  <p className="text-sm text-gray-400 mt-1">Artists you love most</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {recommendations.topArtists.map((artist, index) => (
                    <ArtistCard key={artist.name} artist={artist} index={index} />
                  ))}
                </div>
              </div>
            )}

            {recommendations.recentlyPlayed.length === 0 && 
             recommendations.mostPlayed.length === 0 && 
             recommendations.topArtists.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <p>Keep listening to build personalized recommendations!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

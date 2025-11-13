import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search as SearchIcon, Play, Pause, Plus } from 'lucide-react';
import { usePlayer } from '../services/player';
import { Track } from '../lib/cache';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const { play, addToQueue, currentTrack, state } = usePlayer();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    try {
      const searchResults = await usePlayer.getState().search(query);
      setResults(searchResults);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePlay = async (track: Track) => {
    // Just play the track, it will be auto-removed from queue if it's there
    await play(track);
  };

  const handleAddToQueue = async (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    await addToQueue(track);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Search Header */}
      <div>
        <h1 className="text-3xl md:text-4xl font-black mb-4 md:mb-6">Search</h1>
        <form onSubmit={handleSearch} className="relative">
          <SearchIcon
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            size={20}
          />
          <input
            type="search"
            inputMode="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to listen to?"
            className="w-full bg-white/10 border-0 rounded-full px-12 py-3 md:py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-white/20 text-base"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-white text-black px-4 py-1.5 md:px-6 md:py-2 rounded-full font-semibold hover:bg-gray-200 transition-colors text-sm md:text-base"
          >
            Search
          </button>
        </form>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-gray-600 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Results Grid */}
      {!loading && results.length > 0 && (
        <div>
          <h2 className="text-xl md:text-2xl font-bold mb-4">Top Results</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
            {results.map((track, index) => {
              const isPlaying =
                currentTrack?.videoId === track.videoId && state === 'playing';

              return (
                  <motion.div
                    key={track.videoId}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-white/5 hover:bg-white/10 active:bg-white/15 rounded-lg p-3 md:p-4 cursor-pointer group transition-all"
                  >
                    <div className="relative mb-3 md:mb-4" onClick={() => handlePlay(track)}>
                      <img
                        src={track.thumbnail}
                        alt={track.title}
                        className="w-full aspect-square object-cover rounded shadow-lg"
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        whileHover={{ opacity: 1, y: 0 }}
                        whileTap={{ opacity: 1, y: 0 }}
                        className="absolute bottom-2 right-2"
                      >
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-500 flex items-center justify-center shadow-xl hover:bg-green-400 active:bg-green-600 transition-colors"
                        >
                          {isPlaying ? (
                            <Pause size={18} fill="black" className="text-black md:w-5 md:h-5" />
                          ) : (
                            <Play
                              size={18}
                              fill="black"
                              className="text-black ml-0.5 md:w-5 md:h-5"
                            />
                          )}
                        </motion.button>
                      </motion.div>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate mb-1 text-sm md:text-base">{track.title}</h3>
                        <p className="text-xs md:text-sm text-gray-400 truncate">{track.artist}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDuration(track.duration)}
                        </p>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleAddToQueue(e, track)}
                        className="p-2 rounded-full hover:bg-white/10 active:bg-white/20 transition-colors flex-shrink-0"
                        title="Add to queue"
                      >
                        <Plus size={18} className="text-gray-400 hover:text-white md:w-5 md:h-5" />
                      </motion.button>
                    </div>
                  </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && results.length === 0 && !query && (
        <div className="text-center py-12 md:py-20">
          <SearchIcon size={48} className="mx-auto mb-4 text-gray-700 md:w-16 md:h-16" />
          <h3 className="text-xl md:text-2xl font-bold text-gray-400 mb-2">
            Search for songs and artists
          </h3>
          <p className="text-sm md:text-base text-gray-500">
            Find your favorite music from YouTube
          </p>
        </div>
      )}

      {/* No Results */}
      {!loading && results.length === 0 && query && (
        <div className="text-center py-12 md:py-20">
          <SearchIcon size={48} className="mx-auto mb-4 text-gray-700 md:w-16 md:h-16" />
          <h3 className="text-xl md:text-2xl font-bold text-gray-400 mb-2">
            No results found for "{query}"
          </h3>
          <p className="text-sm md:text-base text-gray-500">Try different keywords</p>
        </div>
      )}
    </div>
  );
}

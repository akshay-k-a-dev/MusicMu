import { motion } from 'framer-motion';
import { Music2, Play } from 'lucide-react';
import { TopArtist } from '../services/recommendations';
import { usePlayer } from '../services/player';

interface ArtistCardProps {
  artist: TopArtist;
  index: number;
}

export default function ArtistCard({ artist, index }: ArtistCardProps) {
  const { play, addToQueue } = usePlayer();
  
  const handlePlayAll = () => {
    if (artist.tracks.length > 0) {
      // Play first track and add rest to queue
      play(artist.tracks[0]);
      artist.tracks.slice(1).forEach(track => {
        addToQueue(track);
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className="group relative bg-gray-800/40 rounded-lg p-4 hover:bg-gray-700/60 transition-all duration-200 cursor-pointer"
      onClick={handlePlayAll}
    >
      {/* Artist thumbnail (using first track) */}
      <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-3">
        {artist.tracks[0]?.thumbnail ? (
          <img
            src={artist.tracks[0].thumbnail}
            alt={artist.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gray-700 flex items-center justify-center">
            <Music2 size={40} className="text-gray-500" />
          </div>
        )}
        
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-purple-600 rounded-full p-4">
            <Play size={24} fill="white" className="text-white" />
          </div>
        </div>
      </div>

      {/* Artist info */}
      <div>
        <h3 className="text-base font-semibold text-white truncate mb-1">
          {artist.name}
        </h3>
        <p className="text-xs text-gray-400">
          {artist.playCount} {artist.playCount === 1 ? 'play' : 'plays'} • {artist.tracks.length} {artist.tracks.length === 1 ? 'track' : 'tracks'}
        </p>
      </div>
    </motion.div>
  );
}

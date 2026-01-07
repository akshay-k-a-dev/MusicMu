import { motion } from 'framer-motion';
import { Play, Music2 } from 'lucide-react';
import { Track } from '../lib/cache';
import { usePlayer } from '../services/player';

interface TrackCardProps {
  track: Track;
  index: number;
}

export default function TrackCard({ track, index }: TrackCardProps) {
  const { currentTrack, state, play } = usePlayer();
  const isPlaying = state === 'playing';
  const isCurrentTrack = currentTrack?.videoId === track.videoId;

  const handlePlay = () => {
    play(track);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group relative bg-gray-800/40 rounded-lg p-3 hover:bg-gray-700/60 transition-all duration-200 cursor-pointer"
      onClick={handlePlay}
    >
      <div className="flex items-center gap-3">
        {/* Thumbnail */}
        <div className="relative flex-shrink-0 w-14 h-14 rounded overflow-hidden">
          {track.thumbnail ? (
            <img
              src={track.thumbnail}
              alt={track.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gray-700 flex items-center justify-center">
              <Music2 size={24} className="text-gray-500" />
            </div>
          )}
          
          {/* Play overlay */}
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-purple-600 rounded-full p-2">
              <Play size={16} fill="white" className="text-white" />
            </div>
          </div>

          {/* Playing indicator */}
          {isCurrentTrack && isPlaying && (
            <div className="absolute inset-0 bg-purple-600/20 flex items-center justify-center">
              <div className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-0.5 bg-purple-500"
                    animate={{
                      height: ['4px', '12px', '4px'],
                    }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.1,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium truncate ${isCurrentTrack ? 'text-purple-400' : 'text-white'}`}>
            {track.title}
          </h3>
          <p className="text-xs text-gray-400 truncate">{track.artist}</p>
        </div>
      </div>
    </motion.div>
  );
}

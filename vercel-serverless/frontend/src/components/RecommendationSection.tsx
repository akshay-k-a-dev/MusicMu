import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { Track } from '../lib/cache';
import TrackCard from './TrackCard';

interface RecommendationSectionProps {
  title: string;
  description?: string;
  tracks: Track[];
  onViewAll?: () => void;
}

export default function RecommendationSection({
  title,
  description,
  tracks,
  onViewAll,
}: RecommendationSectionProps) {
  if (tracks.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-white">{title}</h2>
          {description && (
            <p className="text-sm text-gray-400 mt-1">{description}</p>
          )}
        </div>
        
        {onViewAll && tracks.length > 6 && (
          <button
            onClick={onViewAll}
            className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
          >
            View all
            <ChevronRight size={16} />
          </button>
        )}
      </div>

      {/* Tracks grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tracks.slice(0, 6).map((track, index) => (
          <TrackCard key={`${track.videoId}-${index}`} track={track} index={index} />
        ))}
      </div>
    </motion.div>
  );
}

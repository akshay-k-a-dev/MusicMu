import { Home, Search, Heart, ListMusic, List, User, LogIn } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../lib/authStore';
import { usePlayer } from '../services/player';

export default function Sidebar() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();
  const isPlayerVisible = usePlayer((state) => state.isPlayerVisible);

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/search', icon: Search, label: 'Search' },
    { path: '/liked', icon: Heart, label: 'Liked Songs' },
    { path: '/queue', icon: List, label: 'Queue' },
  ];

  return (
    <div className="w-64 bg-black h-full flex flex-col p-6">
      {/* Logo */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">MusicMu</h1>
        <p className="text-xs text-gray-400 mt-1">Ad-Free Music Streamer</p>
      </div>

      {/* Navigation */}
      <nav className="space-y-2 flex-1 overflow-y-auto">{navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link key={item.path} to={item.path}>
              <motion.div
                whileHover={{ x: 4 }}
                className={`flex items-center gap-4 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon size={24} />
                <span className="font-semibold">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Footer - Position above player when visible */}
      <div className={`border-t border-gray-800 pt-4 mt-4 flex-shrink-0 ${isPlayerVisible ? 'mb-20' : ''}`}>{isAuthenticated ? (
          <Link to="/profile">
            <motion.div
              whileHover={{ x: 4 }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <User size={16} />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  {user?.name || 'Profile'}
                </p>
                <p className="text-xs text-gray-500">View profile</p>
              </div>
            </motion.div>
          </Link>
        ) : (
          <Link to="/login">
            <motion.div
              whileHover={{ x: 4 }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 transition-colors"
            >
              <LogIn size={20} />
              <span className="font-medium">Sign In</span>
            </motion.div>
          </Link>
        )}
        
        <div className="text-xs text-gray-500 pt-2">
          <p>{isAuthenticated ? 'Connected' : 'Guest Mode'}</p>
          <p className="mt-1">{isAuthenticated ? 'Data synced' : 'Data saved locally'}</p>
        </div>
      </div>
    </div>
  );
}

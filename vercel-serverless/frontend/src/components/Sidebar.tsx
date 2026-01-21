import { Home, Search, Heart, List, User, LogIn, Music2, Users } from 'lucide-react';
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
    { path: '/liked', icon: Heart, label: 'Liked' },
    { path: '/playlists', icon: Music2, label: 'Library' },
    { path: '/blends', icon: Users, label: 'Blends' },
    { path: '/queue', icon: List, label: 'Queue' },
  ];

  return (
    <div className="w-52 bg-[#0a0a0a] h-full flex flex-col py-5 px-3 border-r border-white/5">
      {/* Logo */}
      <div className="mb-6 px-3">
        <h1 className="text-xl font-bold text-white">Cantio</h1>
        <p className="text-[10px] text-gray-500 mt-0.5">Ad-Free Music</p>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;

          return (
            <Link key={item.path} to={item.path}>
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative ${
                  isActive
                    ? 'text-white bg-white/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {/* Active indicator line */}
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-purple-500 rounded-full"
                  />
                )}
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-sm font-medium">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Footer - Position above player when visible */}
      <div className={`border-t border-white/5 pt-4 mt-4 flex-shrink-0 ${isPlayerVisible ? 'mb-20' : ''}`}>
        {isAuthenticated ? (
          <Link to="/profile">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <User size={14} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">
                  {user?.name || 'Profile'}
                </p>
                <p className="text-[10px] text-gray-500">Synced</p>
              </div>
            </motion.div>
          </Link>
        ) : (
          <Link to="/login">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all border border-purple-500/20"
            >
              <LogIn size={16} />
              <span className="text-sm font-medium">Sign In</span>
            </motion.div>
          </Link>
        )}
      </div>
    </div>
  );
}

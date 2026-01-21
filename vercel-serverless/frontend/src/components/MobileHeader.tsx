import { User, LogIn } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/authStore';

export default function MobileHeader() {
  const { isAuthenticated, user } = useAuth();

  return (
    <header className="md:hidden fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-md border-b border-white/10 z-50 pt-safe">
      <div className="flex items-center justify-between px-4 h-14">
        {/* Logo */}
        <div>
          <h1 className="text-lg font-bold text-white">Cantio</h1>
        </div>

        {/* Login/Profile Button */}
        <Link
          to={isAuthenticated ? '/profile' : '/login'}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors active:scale-95"
        >
          {isAuthenticated ? (
            <>
              <User size={16} className="text-white" />
              <span className="text-xs text-white font-medium truncate max-w-[80px]">
                {user?.name || 'Profile'}
              </span>
            </>
          ) : (
            <>
              <LogIn size={16} className="text-white" />
              <span className="text-xs text-white font-medium">Login</span>
            </>
          )}
        </Link>
      </div>
    </header>
  );
}

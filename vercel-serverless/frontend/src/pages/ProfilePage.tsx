import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/authStore';
import { motion } from 'framer-motion';
import { User, LogOut, Lock, Eye, EyeOff, Download, Smartphone, MonitorPlay, Apple } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/authStore';
import { SyncButton } from '../components/SyncButton';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
    // Check if running in Electron
    setIsElectron(!!(window as any).electronAPI);
  }, [isAuthenticated, navigate]);

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/(?=.*\d)/.test(password)) {
      return 'Password must contain at least one number';
    }
    return null;
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // Validate new password
    const validationError = validatePassword(passwordForm.newPassword);
    if (validationError) {
      setPasswordError(validationError);
      return;
    }

    // Check if passwords match
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await api.changePassword(
        passwordForm.currentPassword,
        passwordForm.newPassword
      );

      setPasswordSuccess('Password changed successfully!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      
      // Hide the form after 2 seconds
      setTimeout(() => {
        setShowPasswordChange(false);
        setPasswordSuccess('');
      }, 2000);
    } catch (error: any) {
      setPasswordError(error.message || 'Failed to change password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="container mx-auto max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass p-8 rounded-2xl"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{user.name || 'User'}</h1>
              <p className="text-gray-400 text-sm">{user.email}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn-secondary flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Sync Data Section */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <SyncButton />
        </div>

        {/* Password Change Section */}
        <div className="mt-8 pt-8 border-t border-white/10">
          <button
            onClick={() => setShowPasswordChange(!showPasswordChange)}
            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
          >
            <Lock className="w-5 h-5" />
            <span className="font-medium">Change Password</span>
          </button>

          {showPasswordChange && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handlePasswordChange}
              className="mt-6 space-y-4"
            >
              {/* Current Password */}
              <div>
                <label htmlFor="currentPassword" className="block text-sm font-medium mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    id="currentPassword"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500 pr-12"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('current')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    id="newPassword"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500 pr-12"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Must be 8+ characters with uppercase, lowercase, and number
                </p>
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    id="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:border-purple-500 pr-12"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                  >
                    {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  {passwordSuccess}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="btn-primary flex-1"
                  disabled={isLoading}
                >
                  {isLoading ? 'Changing...' : 'Change Password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordChange(false);
                    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setPasswordError('');
                    setPasswordSuccess('');
                  }}
                  className="btn-secondary"
                  disabled={isLoading}
                >
                  Cancel
                </button>
              </div>
            </motion.form>
          )}
        </div>

        {/* Desktop Downloads Section - Hidden in Electron */}
        {!isElectron && (
          <div className="mt-8 pt-8 border-t border-white/10">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Download className="w-5 h-5" />
              Download Desktop App
            </h2>
            
            <div className="space-y-4">
              {/* Windows */}
              <a
                href="https://github.com/akshay-k-a-dev/Cantio/releases/download/cantio-initial/Cantio.Setup.1.0.0.exe"
                className="block p-4 bg-black/30 hover:bg-black/50 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                      <MonitorPlay className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold group-hover:text-purple-400 transition-colors">Windows</h3>
                      <p className="text-sm text-gray-400">Cantio Setup 1.0.0.exe</p>
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-colors" />
                </div>
              </a>

              {/* Linux DEB */}
              <a
                href="https://github.com/akshay-k-a-dev/Cantio/releases/download/cantio-initial/cantio-desktop_1.0.0_amd64.deb"
                className="block p-4 bg-black/30 hover:bg-black/50 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
                      <MonitorPlay className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold group-hover:text-purple-400 transition-colors">Linux (Debian/Ubuntu)</h3>
                      <p className="text-sm text-gray-400">cantio-desktop_1.0.0_amd64.deb</p>
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-colors" />
                </div>
              </a>

              {/* Linux AppImage */}
              <a
                href="https://github.com/akshay-k-a-dev/Cantio/releases/download/cantio-initial/Cantio-1.0.0.AppImage"
                className="block p-4 bg-black/30 hover:bg-black/50 border border-white/10 hover:border-purple-500/50 rounded-xl transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center">
                      <MonitorPlay className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold group-hover:text-purple-400 transition-colors">Linux (AppImage)</h3>
                      <p className="text-sm text-gray-400">Cantio-1.0.0.AppImage</p>
                    </div>
                  </div>
                  <Download className="w-5 h-5 text-gray-400 group-hover:text-purple-400 transition-colors" />
                </div>
              </a>

              {/* Android */}
              <div className="p-4 bg-black/20 border border-white/10 rounded-xl opacity-60">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500 to-lime-500 flex items-center justify-center">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Android</h3>
                      <p className="text-sm text-gray-400">Coming Soon</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* iOS/macOS */}
              <div className="p-4 bg-black/20 border border-white/10 rounded-xl opacity-60">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                    <Apple className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold">iPhone/Mac</h3>
                    <p className="text-sm text-gray-400">Sorry, you're not on my list yet. Please use the web app.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-white/10 text-center text-sm text-gray-400">
          <p>Member since {new Date(user.createdAt).toLocaleDateString()}</p>
        </div>
      </motion.div>
    </div>
  );
}

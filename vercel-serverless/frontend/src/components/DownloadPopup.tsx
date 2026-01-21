import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Download, MonitorPlay } from 'lucide-react';

export default function DownloadPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Don't show in Electron app
    if ((window as any).electronAPI) {
      return;
    }

    // Check if user is on desktop (not mobile)
    const isDesktop = !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    // Check if popup has been shown before
    const hasSeenPopup = localStorage.getItem('cantio-download-popup-seen');

    if (isDesktop && !hasSeenPopup) {
      // Show popup after a short delay
      setTimeout(() => {
        setIsOpen(true);
      }, 1500);
    }
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    localStorage.setItem('cantio-download-popup-seen', 'true');
  };

  const handleDownload = () => {
    handleClose();
    // Navigate to profile page
    navigate('/profile');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 animate-in zoom-in-95 duration-300">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4">
          <div className="bg-gradient-to-br from-purple-500 to-pink-500 p-4 rounded-full">
            <MonitorPlay className="w-12 h-12 text-white" />
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Cantio is Now Available for PC! 🎉
            </h2>
            <p className="text-gray-400">
              Download the desktop app for a better experience with native notifications, system media controls, and offline support.
            </p>
          </div>

          <div className="flex gap-3 w-full">
            <button
              onClick={handleDownload}
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-5 h-5" />
              Download Now
            </button>
            <button
              onClick={handleClose}
              className="px-6 py-3 text-gray-400 hover:text-white transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

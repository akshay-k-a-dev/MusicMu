import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const isInstalled = localStorage.getItem('pwa-installed') === 'true';

    if (isStandalone) {
      localStorage.setItem('pwa-installed', 'true');
      return;
    }

    // Show install button if not installed
    if (!isInstalled) {
      setShowButton(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Auto-show prompt on first visit
      const hasSeenPrompt = sessionStorage.getItem('pwa-prompt-seen');
      if (!hasSeenPrompt && !isInstalled) {
        setShowInstall(true);
        sessionStorage.setItem('pwa-prompt-seen', 'true');
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      localStorage.setItem('pwa-installed', 'true');
      setDeferredPrompt(null);
      setShowInstall(false);
      setShowButton(false);
    }
  };

  const handleDismiss = () => {
    setShowInstall(false);
  };

  const handleButtonClick = () => {
    if (deferredPrompt) {
      setShowInstall(true);
    }
  };

  return (
    <>
      {/* Install Banner */}
      {showInstall && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4 animate-fade-in">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-slide-up border border-gray-700">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">🎵</span>
              </div>
              <div className="flex-1">
                <h3 className="text-white font-bold text-lg mb-1">Install Cantio</h3>
                <p className="text-gray-300 text-sm">Get the full app experience with offline support and quick access</p>
              </div>
            </div>
            
            <div className="space-y-2 mb-6 text-sm">
              <div className="flex items-center gap-2 text-gray-300">
                <span className="text-green-400">✓</span>
                <span>Works offline with cached music</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <span className="text-green-400">✓</span>
                <span>Add to home screen</span>
              </div>
              <div className="flex items-center gap-2 text-gray-300">
                <span className="text-green-400">✓</span>
                <span>Fast and app-like experience</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDismiss}
                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors"
              >
                Not Now
              </button>
              <button
                onClick={handleInstall}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-purple-500/50"
              >
                Install App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Install Button */}
      {showButton && !showInstall && deferredPrompt && (
        <button
          onClick={handleButtonClick}
          className="fixed bottom-24 right-4 md:bottom-8 md:right-8 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-3 rounded-full shadow-2xl shadow-purple-500/50 hover:shadow-purple-500/70 transition-all hover:scale-105 z-40 flex items-center gap-2 font-medium"
        >
          <span className="text-xl">📲</span>
          <span className="hidden md:inline">Install App</span>
        </button>
      )}
    </>
  );
}

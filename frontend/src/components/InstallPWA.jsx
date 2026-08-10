import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export default function InstallPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    const userAgent = window.navigator?.userAgent?.toLowerCase() || '';
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isStandalone = Boolean(
      window.navigator?.standalone ||
      (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)')?.matches)
    );


    if (iosDevice && !isStandalone) {
      setIsIOS(true);
    }

    // Capture Chrome/Android/Edge beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('[PWA] User accepted the install prompt');
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt && !isIOS) return null;

  return (
    <>
      {/* Floating PWA Install Banner */}
      <div className="fixed bottom-5 right-5 z-50 flex items-center bg-indigo-600 text-white px-4 py-3 rounded-2xl shadow-xl border border-indigo-500 animate-bounce hover:animate-none transition-all duration-300">
        <Smartphone className="w-5 h-5 mr-3 shrink-0" />
        <div className="mr-4">
          <p className="text-xs font-bold leading-tight">Install EDUMAN App</p>
          <p className="text-[10px] text-indigo-100 hidden sm:block">Install for fast offline access</p>
        </div>
        <button
          onClick={handleInstallClick}
          className="bg-white text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-indigo-50 transition-colors shadow-xs mr-2 flex items-center"
        >
          <Download className="w-3.5 h-3.5 mr-1" />
          Install
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="text-indigo-200 hover:text-white p-1 rounded-lg"
          aria-label="Close install banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* iOS Modal Guide */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl relative">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-gray-900 mb-2">Install EDUMAN on iOS</h3>
            <p className="text-xs text-gray-600 mb-4">
              To install EDUMAN on your iPhone or iPad:
            </p>
            <div className="text-left text-xs bg-gray-50 p-4 rounded-2xl space-y-2 text-gray-700 font-medium border border-gray-100">
              <p>1. Tap the <span className="font-bold text-indigo-600">Share button</span> (square with up arrow) in Safari.</p>
              <p>2. Scroll down and tap <span className="font-bold text-indigo-600">"Add to Home Screen"</span>.</p>
              <p>3. Tap <span className="font-bold text-indigo-600">Add</span> at the top right.</p>
            </div>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="mt-5 w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-xs hover:bg-indigo-700"
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
}

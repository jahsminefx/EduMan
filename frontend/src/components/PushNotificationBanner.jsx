import React, { useState, useEffect } from 'react';
import { Bell, BellOff, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { isPushSupported, getNotificationPermission, requestPushPermissionAndSubscribe } from '../utils/pushNotificationHelper';

export default function PushNotificationBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isPushSupported()) return;

    const perm = getNotificationPermission();
    const isDismissed = localStorage.getItem('eduman_push_banner_dismissed') === 'true';

    if (perm === 'default' && !isDismissed) {
      // Delay prompt slightly for smoother UX
      const timer = setTimeout(() => setShowBanner(true), 1500);
      return () => clearTimeout(timer);
    } else if (perm === 'granted') {
      // Automatically ensure user subscription is active
      requestPushPermissionAndSubscribe().catch((err) => {
        console.warn('Auto push resubscribe notice:', err.message);
      });
    }
  }, []);

  const handleEnablePush = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      await requestPushPermissionAndSubscribe();
      setSubscribed(true);
      setTimeout(() => setShowBanner(false), 3000);
    } catch (err) {
      console.error('Failed to enable push notifications:', err);
      setErrorMsg(err.message || 'Permission was not granted.');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('eduman_push_banner_dismissed', 'true');
    setShowBanner(false);
  };

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md w-full p-4 bg-white rounded-2xl shadow-2xl border border-blue-100 animate-in fade-in slide-in-from-bottom-5 duration-300">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
        title="Close"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md flex-shrink-0">
          <Bell className="w-6 h-6 animate-pulse" />
        </div>

        <div className="flex-1 pr-6">
          {subscribed ? (
            <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm py-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Desktop & Mobile Notifications Activated!
            </div>
          ) : (
            <>
              <h4 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                Enable Instant Notifications <Sparkles className="w-4 h-4 text-amber-500 fill-amber-500" />
              </h4>
              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                Get native desktop and phone alerts for platform announcements, grades, homework, and live support updates.
              </p>

              {errorMsg && (
                <p className="text-xs text-rose-600 mt-1 font-medium">{errorMsg}</p>
              )}

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEnablePush}
                  disabled={loading}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold rounded-xl shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent" />
                  ) : (
                    <Bell className="w-3.5 h-3.5" />
                  )}
                  Enable Notifications
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors font-medium"
                >
                  Maybe Later
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

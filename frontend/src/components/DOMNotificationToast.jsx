import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Bell, Ticket, Megaphone, Info, CheckCircle2, X, ArrowRight, Sparkles } from 'lucide-react';
import API_URL from '../config/api';
import { useAuth } from '../contexts/AuthContext';

export default function DOMNotificationToast() {
  const [toasts, setToasts] = useState([]);
  const seenNotifIds = useRef(new Set());
  const isFirstLoad = useRef(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchAndShowNewToasts = async () => {
    if (!user) return;
    try {
      const res = await axios.get(`${API_URL}/notifications`);
      const notifs = res.data.notifications || [];

      if (isFirstLoad.current) {
        // On initial load, register existing unread IDs so we don't spam toasts immediately
        notifs.forEach(n => seenNotifIds.current.add(n.id));
        isFirstLoad.current = false;
        return;
      }

      // Find newly arrived unread notifications
      const newNotifs = notifs.filter(n => !n.is_read && !seenNotifIds.current.has(n.id));

      if (newNotifs.length > 0) {
        newNotifs.forEach(n => seenNotifIds.current.add(n.id));

        const newToasts = newNotifs.map(n => ({
          id: n.id,
          title: n.title || 'New Notification',
          message: n.message || '',
          type: n.type || 'info',
          link: n.link || '/dashboard',
          createdAt: n.created_at
        }));

        setToasts(prev => [...prev, ...newToasts]);
      }
    } catch (err) {
      console.warn('DOM Notification poll warning:', err.message);
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchAndShowNewToasts();
    const interval = setInterval(fetchAndShowNewToasts, 10000); // Poll every 10s

    return () => clearInterval(interval);
  }, [user]);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleToastClick = async (toast) => {
    try {
      await axios.put(`${API_URL}/notifications/${toast.id}/read`);
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    }
    removeToast(toast.id);
    if (toast.link) {
      navigate(toast.link);
    }
  };

  if (!user || toasts.length === 0) return null;

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-blue-100/80 animate-in slide-in-from-top-4 fade-in duration-200 transition-all hover:scale-[1.02] cursor-pointer group"
          onClick={() => handleToastClick(toast)}
        >
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-xl text-white flex-shrink-0 shadow-sm ${
              toast.type === 'broadcast'
                ? 'bg-gradient-to-tr from-amber-500 to-orange-500'
                : toast.type === 'support'
                ? 'bg-gradient-to-tr from-purple-600 to-indigo-600'
                : 'bg-gradient-to-tr from-blue-600 to-indigo-600'
            }`}>
              {toast.type === 'broadcast' ? (
                <Megaphone className="w-5 h-5 animate-bounce" />
              ) : toast.type === 'support' ? (
                <Ticket className="w-5 h-5" />
              ) : (
                <Bell className="w-5 h-5" />
              )}
            </div>

            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="font-bold text-gray-900 text-xs truncate">{toast.title}</span>
                {toast.type === 'broadcast' && (
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[9px] font-extrabold uppercase tracking-wider">
                    Broadcast
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed font-medium">
                {toast.message}
              </p>
              <div className="mt-2 flex items-center gap-1 text-[11px] font-bold text-blue-600 group-hover:text-blue-700">
                View Details <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeToast(toast.id);
              }}
              className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Clock, X } from 'lucide-react';
import { Popover } from '../ui/popover';
import { NotificationService } from '@/backend/freelancer';
import { NotificationItem } from '@/shared/types';

export const NotificationMenu: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadNotifications = async () => {
      try {
        const notifs = await NotificationService.getNotifications();
        if (mounted) {
          setNotifications(notifs || []);
        }
      } catch {
        // graceful fallback
      }
    };

    loadNotifications();

    const handleUpdate = () => {
      loadNotifications();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('flowdesk:notifications-updated', handleUpdate);
      window.addEventListener('focus', handleUpdate);
    }

    const interval = setInterval(loadNotifications, 15000);

    return () => {
      mounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('flowdesk:notifications-updated', handleUpdate);
        window.removeEventListener('focus', handleUpdate);
      }
      clearInterval(interval);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = async () => {
    try {
      await NotificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const handleDismiss = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await NotificationService.dismissNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  };

  return (
    <Popover
      align="right"
      trigger={
        <button className="relative p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] animate-pulse" />
          )}
        </button>
      }
    >
      <div className="w-80">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-white">Notifications</h4>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-bold bg-white text-zinc-950 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">No notifications</p>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => {
                  if (n.link && typeof window !== 'undefined') {
                    window.location.href = n.link;
                  }
                }}
                className={`p-3 rounded-xl border transition-colors group relative ${
                  n.link ? 'cursor-pointer hover:border-white/20' : ''
                } ${
                  n.read
                    ? 'bg-zinc-900/30 border-white/5 text-zinc-400'
                    : 'bg-white/[0.05] border-white/10 text-white shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <h5 className="text-xs font-semibold">{n.title}</h5>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {n.timestamp}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => handleDismiss(n.id, e)}
                      title="Dismiss notification"
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded text-zinc-400 hover:text-white transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 mt-1">{n.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </Popover>
  );
};

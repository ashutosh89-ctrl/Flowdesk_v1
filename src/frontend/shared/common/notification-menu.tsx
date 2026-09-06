import React, { useState, useEffect } from 'react';
import { Bell, CheckCheck, Clock } from 'lucide-react';
import { Popover } from '../ui/popover';
import { NotificationService } from '@/backend/freelancer';
import { NotificationItem } from '@/shared/types';

export const NotificationMenu: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    NotificationService.getNotifications().then(setNotifications);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAllRead = () => {
    NotificationService.markAllAsRead().then(() => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    });
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
                className={`p-3 rounded-xl border transition-colors ${
                  n.read
                    ? 'bg-zinc-900/30 border-white/5 text-zinc-400'
                    : 'bg-white/[0.05] border-white/10 text-white shadow-sm'
                }`}
              >
                <div className="flex justify-between items-start gap-2">
                  <h5 className="text-xs font-semibold">{n.title}</h5>
                  <span className="text-[10px] text-zinc-500 flex items-center gap-0.5 shrink-0">
                    <Clock className="w-3 h-3" />
                    {n.timestamp}
                  </span>
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

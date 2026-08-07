'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { PortalNotification } from '../../../types';
import { Bell, Check, Clock, AlertTriangle, Info, CheckCircle2, X } from 'lucide-react';

interface NotificationsPanelProps {
  notifications: PortalNotification[];
  onMarkAllRead: () => void;
  onClose?: () => void;
  onNotificationClick?: (notification: PortalNotification) => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  notifications,
  onMarkAllRead,
  onClose,
  onNotificationClick,
}) => {
  // Group notifications by Today, Yesterday, Earlier
  const todayList = notifications.filter((n) => n.groupedBy === 'today' || n.timestamp.includes('Today') || n.timestamp.includes('m ago') || n.timestamp.includes('h ago'));
  const yesterdayList = notifications.filter((n) => n.groupedBy === 'yesterday' || n.timestamp.includes('Yesterday'));
  const earlierList = notifications.filter((n) => !todayList.includes(n) && !yesterdayList.includes(n));

  const renderGroup = (title: string, list: PortalNotification[]) => {
    if (list.length === 0) return null;

    return (
      <div className="space-y-2">
        <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold px-1">{title}</span>
        <div className="space-y-2">
          {list.map((n) => (
            <div
              key={n.id}
              onClick={() => onNotificationClick && onNotificationClick(n)}
              className={`p-3 rounded-xl border transition-all cursor-pointer ${
                !n.read
                  ? 'bg-white/[0.04] border-white/20 text-white font-medium'
                  : 'bg-zinc-900/50 border-white/5 text-zinc-400'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!n.read && <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />}
                  <h5 className="text-xs font-bold text-white">{n.title}</h5>
                </div>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono uppercase border font-bold ${
                    n.priority === 'high'
                      ? 'bg-red-500/20 text-red-300 border-red-500/30'
                      : n.priority === 'medium'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {n.priority}
                </span>
              </div>
              <p className="text-xs text-zinc-300 mt-1">{n.message}</p>
              <span className="text-[10px] font-mono text-zinc-500 block mt-1">{n.timestamp}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card variant="crystal" className="p-5 max-w-md w-full border-white/20 shadow-2xl bg-zinc-950/95 backdrop-blur-2xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white">Notification Center</h3>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onMarkAllRead} className="text-[11px]">
            Mark Read
          </Button>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
        {notifications.length === 0 ? (
          <p className="text-xs text-zinc-500 italic text-center py-6">No notifications to display.</p>
        ) : (
          <>
            {renderGroup('Today', todayList)}
            {renderGroup('Yesterday', yesterdayList)}
            {renderGroup('Earlier', earlierList)}
          </>
        )}
      </div>
    </Card>
  );
};

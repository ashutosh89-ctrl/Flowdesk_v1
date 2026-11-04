import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  FileText,
  MessageSquare,
  X,
  Check,
  Clock,
  Trash2,
} from 'lucide-react';
import { NotificationItem } from '@/shared/types';
import { NotificationService } from '@/backend/freelancer';

interface NotificationCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onRefresh: () => void;
  onNavigate: (view: string) => void;
}

export const NotificationCenterDrawer: React.FC<NotificationCenterDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onRefresh,
  onNavigate,
}) => {
  const [filterUnread, setFilterUnread] = useState(false);

  const displayed = notifications.filter((n) => !filterUnread || !n.read);

  const handleMarkAllRead = async () => {
    await NotificationService.markAllAsRead();
    onRefresh();
  };

  const handleToggleRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await NotificationService.dismissNotification(id);
    onRefresh();
  };

  const getNotificationIcon = (item: NotificationItem) => {
    switch (item.category || item.type) {
      case 'invoice':
      case 'warning':
        return <Receipt className="w-4 h-4 text-amber-400" />;
      case 'deliverable':
      case 'success':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'comment':
      case 'info':
        return <MessageSquare className="w-4 h-4 text-sky-400" />;
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-rose-400" />;
      default:
        return <Bell className="w-4 h-4 text-indigo-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end select-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-md"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="relative w-full max-w-md bg-[#191F1D] border-l border-[#176B5B]/30 backdrop-blur-3xl h-full shadow-2xl z-10 flex flex-col justify-between"
          >
            <div>
              {/* Header */}
              <div className="p-5 border-b border-[#176B5B]/25 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-[#176B5B]/25 border border-[#176B5B]/40 text-[#43D6B0]">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#F5F5F0] tracking-tight">Notification Center</h3>
                    <p className="text-xs text-[#A6B4AE]">Real-time portal updates &amp; activity alerts.</p>
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[#A6B4AE] hover:text-[#F5F5F0] hover:bg-[#176B5B]/20 transition-colors"
                  aria-label="Close notifications"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Action Bar */}
              <div className="p-3 px-5 border-b border-[#176B5B]/20 bg-[#141817] flex items-center justify-between text-xs">
                <button
                  onClick={() => setFilterUnread(!filterUnread)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    filterUnread
                      ? 'bg-[#176B5B]/30 text-[#43D6B0] border border-[#176B5B]/50'
                      : 'text-[#A6B4AE] hover:text-[#F5F5F0]'
                  }`}
                >
                  {filterUnread ? 'Showing Unread Only' : 'Filter Unread'}
                </button>

                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-semibold text-[#43D6B0] hover:text-[#43D6B0]/80 flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" /> Mark All Read
                </button>
              </div>

              {/* List */}
              <div className="p-4 space-y-2 max-h-[calc(100vh-180px)] overflow-y-auto">
                {displayed.length === 0 ? (
                  <div className="p-12 text-center text-xs text-[#A6B4AE]">
                    No notifications to show.
                  </div>
                ) : (
                  displayed.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        // Route to specific entity when possible
                        if (n.link) {
                          onNavigate(n.link);
                        } else if (n.category === 'invoice') {
                          onNavigate('invoices');
                        } else if (n.category === 'deliverable') {
                          onNavigate('deliverables');
                        } else if (n.category === 'document') {
                          onNavigate('documents');
                        } else if (n.category === 'project') {
                          onNavigate('projects');
                        } else if (n.category === 'comment') {
                          onNavigate('activity');
                        } else {
                          onNavigate('activity');
                        }
                        onClose();
                      }}
                      className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                        !n.read
                          ? 'bg-[#141817] border-[#176B5B]/40 shadow-sm'
                          : 'bg-[#191F1D] border-[#176B5B]/20 text-[#A6B4AE] opacity-75'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-white/5 border border-[#176B5B]/30 shrink-0 mt-0.5">
                          {getNotificationIcon(n)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="text-xs font-bold text-[#F5F5F0] truncate">{n.title}</h4>
                            {!n.read && <span className="w-2 h-2 rounded-full bg-[#43D6B0] shrink-0" />}
                          </div>
                          <p className="text-xs text-[#A6B4AE] line-clamp-2">{n.message}</p>
                          <span className="text-[10px] font-mono text-[#A6B4AE]/70 mt-1 block">{n.timestamp}</span>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleToggleRead(n.id, e)}
                        title={n.read ? 'Mark unread' : 'Mark read'}
                        className="p-1 rounded text-[#A6B4AE] hover:text-[#F5F5F0] transition-colors shrink-0"
                      >
                        <Check className={`w-3.5 h-3.5 ${n.read ? 'text-emerald-400' : ''}`} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#2A2A2A] bg-[#0A0A0A] text-center text-[11px] text-zinc-500">
              All notifications up to date
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: ToastType;
}

interface ToastContextType {
  showToast: (title: string, description?: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    // Safe fallback so useToast never crashes rendering if called outside ToastProvider
    return {
      showToast: (title: string, description?: string, type?: ToastType) => {
        if (typeof window !== 'undefined') {
          console.log(`[Toast ${type || 'info'}]: ${title}${description ? ` - ${description}` : ''}`);
        }
      },
    };
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((title: string, description?: string, type: ToastType = 'info') => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, title, description, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="pointer-events-auto bg-zinc-900/95 border border-white/15 backdrop-blur-xl rounded-xl p-4 shadow-2xl flex items-start gap-3 relative overflow-hidden"
            >
              <div className="mt-0.5 text-white shrink-0">
                {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-white" />}
                {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-zinc-300" />}
                {toast.type === 'info' && <Info className="w-5 h-5 text-zinc-400" />}
              </div>
              <div className="flex-1 pr-4">
                <h4 className="text-sm font-semibold text-white">{toast.title}</h4>
                {toast.description && <p className="text-xs text-zinc-400 mt-0.5">{toast.description}</p>}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
};

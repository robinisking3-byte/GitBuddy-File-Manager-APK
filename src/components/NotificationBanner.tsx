import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Bell,
  X,
  Package,
} from 'lucide-react';
import { notificationService, AppNotification } from '../services/notificationService';

interface NotificationBannerProps {
  onOpenWorkflowsTab?: () => void;
}

export const NotificationBanner: React.FC<NotificationBannerProps> = ({ onOpenWorkflowsTab }) => {
  const [activeToast, setActiveToast] = useState<AppNotification | null>(null);

  useEffect(() => {
    const unsubscribe = notificationService.subscribe((notification) => {
      setActiveToast(notification);
      // Auto-dismiss after 6 seconds
      const timer = setTimeout(() => {
        setActiveToast((current) => (current?.id === notification.id ? null : current));
      }, 6000);
      return () => clearTimeout(timer);
    });

    return unsubscribe;
  }, []);

  if (!activeToast) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm w-full animate-in slide-in-from-bottom-5 fade-in duration-200">
      <div
        className={`p-4 rounded-xl border shadow-2xl flex items-start gap-3 backdrop-blur-md ${
          activeToast.type === 'success'
            ? 'bg-[#161b22]/95 border-emerald-500/50 text-slate-100'
            : activeToast.type === 'failure'
            ? 'bg-[#161b22]/95 border-rose-500/50 text-slate-100'
            : 'bg-[#161b22]/95 border-blue-500/50 text-slate-100'
        }`}
      >
        <div className="shrink-0 mt-0.5">
          {activeToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : activeToast.type === 'failure' ? (
            <XCircle className="w-5 h-5 text-rose-400" />
          ) : (
            <Bell className="w-5 h-5 text-blue-400" />
          )}
        </div>

        <div className="flex-1 min-w-0 text-xs">
          <div className="font-semibold text-white mb-0.5">{activeToast.title}</div>
          <div className="text-slate-300 leading-relaxed">{activeToast.message}</div>
          {onOpenWorkflowsTab && (
            <button
              onClick={() => {
                setActiveToast(null);
                onOpenWorkflowsTab();
              }}
              className="mt-2 text-emerald-400 hover:text-emerald-300 font-medium inline-flex items-center gap-1 hover:underline"
            >
              <Package className="w-3 h-3" />
              <span>View Artifacts & Workflows</span>
            </button>
          )}
        </div>

        <button
          onClick={() => setActiveToast(null)}
          className="text-slate-400 hover:text-white shrink-0 p-0.5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Bell, Check, X, ShieldAlert, Sparkles } from 'lucide-react';
import { notificationService } from '../services/notificationService';

interface NotificationPermissionPromptProps {
  onPermissionChanged?: (permission: NotificationPermission) => void;
}

export const NotificationPermissionPrompt: React.FC<NotificationPermissionPromptProps> = ({
  onPermissionChanged,
}) => {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [dismissed, setDismissed] = useState<boolean>(false);
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const [justGranted, setJustGranted] = useState<boolean>(false);

  useEffect(() => {
    if (!notificationService.isSupported()) {
      setDismissed(true);
      return;
    }

    const current = notificationService.getPermission();
    setPermission(current);

    // If dismissed before in this session
    const isDismissed = sessionStorage.getItem('gitbuddy_dismiss_notify_prompt');
    if (isDismissed === 'true' || current === 'granted') {
      setDismissed(true);
    }
  }, []);

  const handleAllowNotifications = async () => {
    setIsRequesting(true);
    try {
      const res = await notificationService.requestPermission();
      setPermission(res);
      if (onPermissionChanged) onPermissionChanged(res);

      if (res === 'granted') {
        setJustGranted(true);
        // Fire a test welcome notification
        notificationService.notifyWorkflowEvent({
          type: 'success',
          workflowName: 'GitBuddy Push Notifications',
          repoName: 'gitbuddy/mobile',
          branch: 'production',
          runNumber: 1,
          conclusion: 'success',
        });
        setTimeout(() => {
          setDismissed(true);
        }, 2500);
      } else {
        setDismissed(true);
        sessionStorage.setItem('gitbuddy_dismiss_notify_prompt', 'true');
      }
    } catch (err) {
      console.warn('Error requesting notification permission:', err);
      setDismissed(true);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('gitbuddy_dismiss_notify_prompt', 'true');
  };

  if (dismissed || !notificationService.isSupported()) return null;

  return (
    <div className="bg-gradient-to-r from-emerald-950/40 via-[#161b22] to-sky-950/30 border border-emerald-500/30 rounded-xl p-3.5 sm:p-4 shadow-xl transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5 sm:mt-0">
            {justGranted ? (
              <Check className="w-5 h-5 text-emerald-400" />
            ) : permission === 'denied' ? (
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            ) : (
              <Bell className="w-5 h-5 text-emerald-400 animate-pulse" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h4 className="text-xs sm:text-sm font-semibold text-white">
                {justGranted
                  ? 'Push Notifications Activated!'
                  : 'Enable GitHub Actions Push Notifications'}
              </h4>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded border border-emerald-500/30">
                Live Alert
              </span>
            </div>
            <p className="text-xs text-slate-300">
              {justGranted
                ? 'You will now receive instant push notifications and chimes for workflow success, failure, and APK build readiness.'
                : 'Get instant alerts when CI/CD workflows complete, succeed, fail, or when new APK downloads become available.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {!justGranted && (
            <>
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-md hover:bg-[#21262d] transition-colors"
              >
                Not Now
              </button>
              <button
                type="button"
                onClick={handleAllowNotifications}
                disabled={isRequesting}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-md transition-all shadow-sm flex items-center gap-1.5 active:scale-95"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isRequesting ? 'Prompting...' : 'Allow Notifications'}</span>
              </button>
            </>
          )}

          {justGranted && (
            <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
              <Check className="w-4 h-4" />
              <span>Permission Granted</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            className="text-slate-400 hover:text-white p-1 ml-1"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

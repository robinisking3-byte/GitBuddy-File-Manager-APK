import React, { useEffect, useState } from 'react';
import { CheckCircle2, ShieldCheck, Database, GitBranch } from 'lucide-react';

interface AccountConnectedTransitionProps {
  isVisible: boolean;
  username: string;
  avatarUrl?: string;
  onTransitionEnd: () => void;
}

export const AccountConnectedTransition: React.FC<AccountConnectedTransitionProps> = ({
  isVisible,
  username,
  avatarUrl,
  onTransitionEnd,
}) => {
  const [stage, setStage] = useState<'enter' | 'active' | 'exit' | 'idle'>('idle');

  useEffect(() => {
    if (isVisible) {
      setStage('enter');
      const enterTimer = setTimeout(() => {
        setStage('active');
      }, 50);

      const exitTimer = setTimeout(() => {
        setStage('exit');
      }, 1600);

      const endTimer = setTimeout(() => {
        setStage('idle');
        onTransitionEnd();
      }, 1950);

      return () => {
        clearTimeout(enterTimer);
        clearTimeout(exitTimer);
        clearTimeout(endTimer);
      };
    } else {
      setStage('idle');
    }
  }, [isVisible, onTransitionEnd]);

  if (!isVisible && stage === 'idle') return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md transition-opacity duration-300 pointer-events-auto ${
        stage === 'enter'
          ? 'opacity-0'
          : stage === 'active'
          ? 'opacity-100'
          : 'opacity-0 pointer-events-none'
      }`}
    >
      <div
        className={`bg-[#161b22] border border-emerald-500/50 rounded-2xl max-w-sm w-full p-8 text-center shadow-2xl relative overflow-hidden transition-all duration-300 transform ${
          stage === 'enter'
            ? 'scale-90 translate-y-3'
            : stage === 'active'
            ? 'scale-100 translate-y-0'
            : 'scale-95 -translate-y-2'
        }`}
      >
        {/* Subtle radial emerald backdrop glow */}
        <div className="absolute inset-0 bg-radial from-emerald-500/15 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center space-y-4">
          {/* Avatar with success badge */}
          <div className="relative">
            <div className="w-20 h-20 rounded-full p-1 bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/20">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={username}
                  className="w-full h-full rounded-full object-cover bg-[#0d1117]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-[#0d1117] flex items-center justify-center text-xl font-bold text-emerald-400 font-mono">
                  {username[0]?.toUpperCase()}
                </div>
              )}
            </div>

            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 border-2 border-[#161b22] flex items-center justify-center text-white shadow-md animate-in zoom-in duration-200">
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
            </div>
          </div>

          {/* Heading and text */}
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white tracking-tight">
              Account Connected Successfully
            </h3>
            <div className="text-sm font-semibold text-emerald-400 font-mono">
              @{username}
            </div>
          </div>

          <p className="text-xs text-slate-400 max-w-xs">
            PAT credentials verified and synced with Firebase Firestore database.
          </p>

          {/* Animated syncing bar */}
          <div className="w-full pt-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 font-mono">
              <span className="flex items-center gap-1 text-slate-300">
                <Database className="w-3 h-3 text-emerald-400" />
                Loading Repositories...
              </span>
              <span className="text-emerald-400">Ready</span>
            </div>
            <div className="w-full bg-[#21262d] h-1.5 rounded-full overflow-hidden">
              <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full animate-[pulse_1s_ease-in-out_infinite]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

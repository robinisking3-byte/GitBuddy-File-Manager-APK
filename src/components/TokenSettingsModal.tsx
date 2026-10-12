import React, { useState, useEffect } from 'react';
import { KeyRound, X, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { githubApi, saveStoredToken, clearStoredToken } from '../services/githubApi';
import { GitHubUser, RateLimitInfo } from '../types/github';

interface TokenSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentToken: string;
  onTokenUpdated: (newToken: string) => void;
  currentUser: GitHubUser | null;
}

export const TokenSettingsModal: React.FC<TokenSettingsModalProps> = ({
  isOpen,
  onClose,
  currentToken,
  onTokenUpdated,
  currentUser,
}) => {
  const [tokenInput, setTokenInput] = useState(currentToken);
  const [showToken, setShowToken] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<{
    tested: boolean;
    success: boolean;
    message: string;
    user?: GitHubUser;
  }>({
    tested: false,
    success: false,
    message: '',
  });

  useEffect(() => {
    if (isOpen) {
      setTokenInput(currentToken);
      checkRateLimits(currentToken);
    }
  }, [isOpen, currentToken]);

  const checkRateLimits = async (tok: string) => {
    try {
      const rl = await githubApi.getRateLimit(tok);
      setRateLimit(rl);
    } catch {
      setRateLimit(null);
    }
  };

  const handleVerify = async () => {
    if (!tokenInput.trim()) return;
    setIsVerifying(true);
    setVerifyStatus({ tested: false, success: false, message: '' });

    try {
      const user = await githubApi.getUser(tokenInput.trim());
      const rl = await githubApi.getRateLimit(tokenInput.trim());
      setRateLimit(rl);
      setVerifyStatus({
        tested: true,
        success: true,
        message: `Successfully authenticated as ${user.login} (${user.public_repos} public repos)!`,
        user,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setVerifyStatus({
        tested: true,
        success: false,
        message: `Verification failed: ${errorMsg}`,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSave = () => {
    const trimmed = tokenInput.trim();
    if (!trimmed) return;
    saveStoredToken(trimmed);
    onTokenUpdated(trimmed);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">GitHub Access Token (PAT)</h3>
              <p className="text-xs text-slate-400">Fine-grained or classic personal access token</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 py-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Personal Access Token
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="ghp_... or github_pat_..."
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 pr-10 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              Tokens require <code className="text-emerald-400">repo</code> (contents, actions, workflows) and <code className="text-emerald-400">read:user</code> scopes.
            </p>
          </div>

          {/* Rate limits summary */}
          {rateLimit && (
            <div className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-slate-300 font-medium">API Rate Limit</span>
              </div>
              <div className="text-right">
                <span className="font-mono text-emerald-400 font-semibold">{rateLimit.remaining}</span>
                <span className="text-slate-500 font-mono"> / {rateLimit.limit} req/hr</span>
              </div>
            </div>
          )}

          {/* Verification feedback */}
          {verifyStatus.tested && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                verifyStatus.success
                  ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
              }`}
            >
              {verifyStatus.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              )}
              <div>
                <p className="font-medium">{verifyStatus.message}</p>
                {verifyStatus.user && (
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    User ID: {verifyStatus.user.id} · Profile: {verifyStatus.user.login}
                  </p>
                )}
              </div>
            </div>
          )}

          {currentUser && (
            <div className="flex items-center gap-3 p-3 bg-[#0d1117] border border-[#30363d] rounded-lg">
              <img
                src={currentUser.avatar_url}
                alt={currentUser.login}
                className="w-10 h-10 rounded-full border border-slate-700"
                referrerPolicy="no-referrer"
              />
              <div className="text-xs">
                <div className="font-semibold text-slate-200">{currentUser.name || currentUser.login}</div>
                <div className="text-slate-400">@{currentUser.login}</div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end pt-4 border-t border-[#30363d] gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors"
          >
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
};

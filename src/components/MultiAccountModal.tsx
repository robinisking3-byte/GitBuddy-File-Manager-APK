import React, { useState, useEffect } from 'react';
import {
  Users,
  X,
  Plus,
  KeyRound,
  Check,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Database,
  ExternalLink,
  ShieldCheck,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  savePatAccountToFirestore,
  fetchPatAccountsFromFirestore,
  deletePatAccountFromFirestore,
  FirebasePatAccount,
} from '../services/firebase';
import { githubApi } from '../services/githubApi';

interface MultiAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeToken: string;
  activeUsername: string;
  onSwitchAccount: (account: { username: string; patToken: string; avatarUrl?: string }) => void;
  onLogoutCurrent: () => void;
}

export const MultiAccountModal: React.FC<MultiAccountModalProps> = ({
  isOpen,
  onClose,
  activeToken,
  activeUsername,
  onSwitchAccount,
  onLogoutCurrent,
}) => {
  const [accounts, setAccounts] = useState<FirebasePatAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Form states
  const [newUsername, setNewUsername] = useState('');
  const [newToken, setNewToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    setIsLoading(true);
    try {
      const list = await fetchPatAccountsFromFirestore();
      setAccounts(list);
    } catch (err) {
      console.warn('Failed to load accounts from Firestore:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newToken.trim()) return;

    setIsVerifying(true);
    setFormError(null);
    setFormSuccess(null);

    try {
      // 1. Verify token with GitHub
      const user = await githubApi.getUser(newToken.trim());
      const usernameToSave = user.login;

      // 2. Save into Firebase Firestore in requested format: username & Pat token
      await savePatAccountToFirestore({
        username: usernameToSave,
        patToken: newToken.trim(),
        avatarUrl: user.avatar_url,
      });

      setFormSuccess(`Account @${usernameToSave} saved to Firebase Firestore successfully!`);
      setNewToken('');
      setNewUsername('');
      setShowAddForm(false);
      await loadAccounts();

      // Automatically switch to this new account
      onSwitchAccount({ username: usernameToSave, patToken: newToken.trim() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(`Account verification failed: ${msg}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDelete = async (username: string) => {
    if (!confirm(`Remove saved PAT account @${username} from Firebase database?`)) return;
    try {
      await deletePatAccountFromFirestore(username);
      if (activeUsername.toLowerCase() === username.toLowerCase()) {
        onLogoutCurrent();
      }
      await loadAccounts();
    } catch (err: unknown) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 lg:p-6 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">GitHub PAT Account Manager</h3>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Database className="w-3 h-3 text-emerald-400" />
                <span>Synced with Firebase Firestore</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Account
              </button>
            )}
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-md">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* Add Account Form */}
          {showAddForm && (
            <form onSubmit={handleAddAccount} className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-emerald-400" />
                  Connect New GitHub PAT
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              {formError && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{formSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  GitHub Personal Access Token (PAT) <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    required
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                    placeholder="github_pat_... or ghp_..."
                    className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 pr-9 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Tokens are stored securely in Firestore (/pat_accounts).
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#21262d]">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifying || !newToken.trim()}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md transition-colors flex items-center gap-1.5"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Verifying & Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Verify & Save Account
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Accounts List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">
                Database Accounts ({accounts.length})
              </span>
              <span>Stored in Firestore /pat_accounts</span>
            </div>

            {isLoading ? (
              <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                <span>Loading accounts from Firebase...</span>
              </div>
            ) : accounts.length === 0 ? (
              <div className="p-8 text-center bg-[#0d1117] border border-[#30363d] rounded-xl text-xs space-y-3">
                <Users className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-slate-400">No PAT accounts saved in the database yet.</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors"
                >
                  Add Your First Account
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#21262d] border border-[#30363d] rounded-xl overflow-hidden bg-[#0d1117]">
                {accounts.map((acc) => {
                  const isActive =
                    (activeUsername && acc.username.toLowerCase() === activeUsername.toLowerCase()) ||
                    acc.patToken === activeToken;
                  const maskedToken = `${acc.patToken.substring(0, 8)}••••••••${acc.patToken.substring(acc.patToken.length - 4)}`;

                  return (
                    <div
                      key={acc.id || acc.username}
                      className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                        isActive ? 'bg-emerald-950/20 border-l-2 border-emerald-500' : 'hover:bg-[#161b22]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {acc.avatarUrl ? (
                          <img
                            src={acc.avatarUrl}
                            alt={acc.username}
                            className="w-9 h-9 rounded-full ring-1 ring-emerald-500/40 shrink-0"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[#21262d] border border-[#30363d] flex items-center justify-center font-bold text-slate-300 shrink-0">
                            {acc.username[0]?.toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-100">username : {acc.username}</span>
                            {isActive && (
                              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> active
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400 truncate">
                            Pat token : <span className="text-slate-300">{maskedToken}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isActive ? (
                          <button
                            onClick={onLogoutCurrent}
                            className="px-2.5 py-1 text-xs font-medium text-rose-400 hover:text-white bg-rose-950/30 hover:bg-rose-900/60 border border-rose-500/30 rounded transition-colors"
                          >
                            Disconnect
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 text-[10px] font-mono text-slate-500 bg-[#161b22] border border-[#21262d] rounded">
                            Saved in DB
                          </span>
                        )}

                        <button
                          onClick={() => handleDelete(acc.username)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded transition-colors"
                          title="Delete from database"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#30363d] bg-[#161b22] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Connected accounts are saved in Firebase Firestore database as username & Pat token.</span>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-slate-200 rounded text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

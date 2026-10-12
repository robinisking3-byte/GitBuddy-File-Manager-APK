import React, { useState } from 'react';
import { FolderGit2, X, Lock, Globe, Plus, Loader2 } from 'lucide-react';
import { githubApi } from '../services/githubApi';
import { GitHubRepo } from '../types/github';

interface CreateRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onRepoCreated: (newRepo: GitHubRepo) => void;
}

export const CreateRepoModal: React.FC<CreateRepoModalProps> = ({
  isOpen,
  onClose,
  token,
  onRepoCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [autoInit, setAutoInit] = useState(true);
  const [gitignoreTemplate, setGitignoreTemplate] = useState('Node');
  const [licenseTemplate, setLicenseTemplate] = useState('mit');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const newRepo = await githubApi.createRepo(token, {
        name: name.trim(),
        description: description.trim() || undefined,
        private: isPrivate,
        auto_init: autoInit,
        gitignore_template: gitignoreTemplate !== 'none' ? gitignoreTemplate : undefined,
        license_template: licenseTemplate !== 'none' ? licenseTemplate : undefined,
      });

      onRepoCreated(newRepo);
      setName('');
      setDescription('');
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-lg w-full p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Create Repository</h3>
              <p className="text-xs text-slate-400">Provision a new Git repository on GitHub</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-300">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Repository Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, '-'))}
              placeholder="e.g. flutter-backend-service"
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Description <span className="text-slate-500">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of repository purpose"
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">
              Visibility
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isPrivate
                    ? 'bg-emerald-950/20 border-emerald-500/50 text-white'
                    : 'bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={isPrivate}
                  onChange={() => setIsPrivate(true)}
                  className="hidden"
                />
                <Lock className={`w-4 h-4 ${isPrivate ? 'text-emerald-400' : 'text-slate-500'}`} />
                <div className="text-left">
                  <div className="text-xs font-semibold">Private</div>
                  <div className="text-[11px] text-slate-400">Only you choose access</div>
                </div>
              </label>

              <label
                className={`flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                  !isPrivate
                    ? 'bg-emerald-950/20 border-emerald-500/50 text-white'
                    : 'bg-[#0d1117] border-[#30363d] text-slate-400 hover:text-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="visibility"
                  checked={!isPrivate}
                  onChange={() => setIsPrivate(false)}
                  className="hidden"
                />
                <Globe className={`w-4 h-4 ${!isPrivate ? 'text-emerald-400' : 'text-slate-500'}`} />
                <div className="text-left">
                  <div className="text-xs font-semibold">Public</div>
                  <div className="text-[11px] text-slate-400">Anyone on the internet</div>
                </div>
              </label>
            </div>
          </div>

          <div className="pt-2 border-t border-[#30363d] space-y-3">
            <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoInit}
                onChange={(e) => setAutoInit(e.target.checked)}
                className="rounded border-[#30363d] text-emerald-600 focus:ring-emerald-500"
              />
              <span>Initialize with a README file (recommended for immediate file browsing)</span>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">.gitignore Template</label>
                <select
                  value={gitignoreTemplate}
                  onChange={(e) => setGitignoreTemplate(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="none">None</option>
                  <option value="Node">Node.js</option>
                  <option value="Python">Python</option>
                  <option value="Flutter">Flutter / Dart</option>
                  <option value="Go">Go</option>
                  <option value="Rust">Rust</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">License Template</label>
                <select
                  value={licenseTemplate}
                  onChange={(e) => setLicenseTemplate(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="none">None</option>
                  <option value="mit">MIT License</option>
                  <option value="apache-2.0">Apache 2.0</option>
                  <option value="gpl-3.0">GNU GPL v3</option>
                  <option value="isc">ISC License</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end pt-4 border-t border-[#30363d] gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !name.trim()}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md transition-colors flex items-center gap-1.5"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Create Repository
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

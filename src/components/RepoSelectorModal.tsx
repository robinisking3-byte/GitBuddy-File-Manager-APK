import React, { useState } from 'react';
import {
  FolderGit2,
  X,
  Search,
  Lock,
  Globe,
  Plus,
  Star,
  Check,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { GitHubRepo } from '../types/github';
import { githubApi } from '../services/githubApi';

interface RepoSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  repos: GitHubRepo[];
  activeRepo: GitHubRepo | null;
  onSelectRepo: (repo: GitHubRepo) => void;
  onOpenCreateModal: () => void;
  token: string;
  onRepoDeleted: (deletedRepoFullName: string) => void;
}

export const RepoSelectorModal: React.FC<RepoSelectorModalProps> = ({
  isOpen,
  onClose,
  repos,
  activeRepo,
  onSelectRepo,
  onOpenCreateModal,
  token,
  onRepoDeleted,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'private' | 'public'>('all');
  const [confirmDeleteRepo, setConfirmDeleteRepo] = useState<GitHubRepo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (!isOpen) return null;

  const filteredRepos = repos.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesSearch) return false;
    if (filterType === 'private') return r.private;
    if (filterType === 'public') return !r.private;
    return true;
  });

  const handleDelete = async () => {
    if (!confirmDeleteRepo) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const [owner, name] = confirmDeleteRepo.full_name.split('/');
      await githubApi.deleteRepo(token, owner, name);
      onRepoDeleted(confirmDeleteRepo.full_name);
      setConfirmDeleteRepo(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDeleteError(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FolderGit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Select Repository</h3>
              <p className="text-xs text-slate-400">Manage and switch working repositories</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenCreateModal();
              }}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              New Repo
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="p-4 border-b border-[#30363d] space-y-3 bg-[#0d1117]/50">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter repositories by name or description..."
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                filterType === 'all'
                  ? 'bg-[#21262d] text-white border border-[#30363d]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({repos.length})
            </button>
            <button
              onClick={() => setFilterType('private')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                filterType === 'private'
                  ? 'bg-[#21262d] text-white border border-[#30363d]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Private ({repos.filter((r) => r.private).length})
            </button>
            <button
              onClick={() => setFilterType('public')}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                filterType === 'public'
                  ? 'bg-[#21262d] text-white border border-[#30363d]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Public ({repos.filter((r) => !r.private).length})
            </button>
          </div>
        </div>

        {/* Delete Confirmation Warning Drawer */}
        {confirmDeleteRepo && (
          <div className="m-4 p-4 bg-rose-950/40 border border-rose-500/50 rounded-lg text-xs space-y-3">
            <div className="flex items-center gap-2 text-rose-400 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Are you sure you want to delete {confirmDeleteRepo.full_name}?</span>
            </div>
            <p className="text-slate-300">
              This action cannot be undone. It will permanently remove the repository, all branches, commits, and workflows from GitHub.
            </p>
            {deleteError && <div className="text-rose-300 font-mono text-[11px]">{deleteError}</div>}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteRepo(null)}
                className="px-3 py-1 text-xs text-slate-300 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-3 py-1 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-md transition-colors flex items-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                Yes, Delete Repository
              </button>
            </div>
          </div>
        )}

        {/* Repository List */}
        <div className="overflow-y-auto flex-1 p-2 divide-y divide-[#21262d]">
          {filteredRepos.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No repositories matched your search query.
            </div>
          ) : (
            filteredRepos.map((repo) => {
              const isSelected = activeRepo?.id === repo.id;
              return (
                <div
                  key={repo.id}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors group ${
                    isSelected ? 'bg-emerald-950/20 border border-emerald-500/30' : 'hover:bg-[#21262d]/60'
                  }`}
                >
                  <div
                    className="flex-1 cursor-pointer pr-3"
                    onClick={() => {
                      onSelectRepo(repo);
                      onClose();
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {repo.private ? (
                        <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      ) : (
                        <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                      )}
                      <span className="font-semibold text-sm text-slate-100 group-hover:text-emerald-400 transition-colors">
                        {repo.name}
                      </span>
                      {isSelected && (
                        <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-0.5">
                          <Check className="w-3 h-3" /> active
                        </span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-xs text-slate-400 line-clamp-1 mb-1.5">{repo.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      {repo.language && (
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                          {repo.language}
                        </span>
                      )}
                      <span>branch: <span className="font-mono text-slate-300">{repo.default_branch}</span></span>
                      {repo.stargazers_count > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-amber-400" />
                          {repo.stargazers_count}
                        </span>
                      )}
                      <span>
                        updated {new Date(repo.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#30363d] rounded-md transition-colors"
                      title="Open on GitHub"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteRepo(repo);
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-md transition-colors"
                      title="Delete repository"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

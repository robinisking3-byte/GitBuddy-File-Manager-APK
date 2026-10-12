import React, { useState } from 'react';
import {
  FolderGit2,
  Lock,
  Globe,
  Plus,
  Search,
  Star,
  ExternalLink,
  FolderOpen,
  FileArchive,
  PlaySquare,
  Trash2,
  GitBranch,
} from 'lucide-react';
import { GitHubRepo } from '../types/github';

interface ReposListViewProps {
  repos: GitHubRepo[];
  activeRepo: GitHubRepo | null;
  onSelectRepo: (repo: GitHubRepo) => void;
  onOpenCreateRepo: () => void;
  onOpenZipForRepo: (repo: GitHubRepo) => void;
  onOpenWorkflowsForRepo: (repo: GitHubRepo) => void;
  onOpenRepoDelete: (repo: GitHubRepo) => void;
}

export const ReposListView: React.FC<ReposListViewProps> = ({
  repos,
  activeRepo,
  onSelectRepo,
  onOpenCreateRepo,
  onOpenZipForRepo,
  onOpenWorkflowsForRepo,
  onOpenRepoDelete,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'private' | 'public'>('all');

  const filteredRepos = repos.filter((r) => {
    const matchesQuery =
      r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.description && r.description.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchesQuery) return false;
    if (visibilityFilter === 'private') return r.private;
    if (visibilityFilter === 'public') return !r.private;
    return true;
  });

  const totalPrivate = repos.filter((r) => r.private).length;
  const totalPublic = repos.filter((r) => !r.private).length;
  const totalStars = repos.reduce((acc, r) => acc + r.stargazers_count, 0);

  return (
    <div className="space-y-4">
      {/* Top Banner & Stats */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <FolderGit2 className="w-5 h-5 text-emerald-400" />
              Repository Management Console
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Browse, provision and manage repositories across your authenticated GitHub account
            </p>
          </div>

          <button
            onClick={onOpenCreateRepo}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Create Repository
          </button>
        </div>

        {/* 3 Metrics Strip without decorative badges or slop */}
        <div className="grid grid-cols-3 gap-4 pt-4 mt-4 border-t border-[#30363d] text-xs">
          <div>
            <div className="text-slate-400">Total Repositories</div>
            <div className="text-lg font-bold text-slate-100 font-mono tabular-nums">{repos.length}</div>
          </div>
          <div>
            <div className="text-slate-400">Private Repos</div>
            <div className="text-lg font-bold text-amber-400 font-mono tabular-nums">{totalPrivate}</div>
          </div>
          <div>
            <div className="text-slate-400">Public Repos</div>
            <div className="text-lg font-bold text-blue-400 font-mono tabular-nums">{totalPublic}</div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search repositories..."
            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1 self-start sm:self-auto">
          <button
            onClick={() => setVisibilityFilter('all')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
              visibilityFilter === 'all'
                ? 'bg-[#21262d] text-white border border-[#30363d]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setVisibilityFilter('private')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
              visibilityFilter === 'private'
                ? 'bg-[#21262d] text-white border border-[#30363d]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Private
          </button>
          <button
            onClick={() => setVisibilityFilter('public')}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
              visibilityFilter === 'public'
                ? 'bg-[#21262d] text-white border border-[#30363d]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Public
          </button>
        </div>
      </div>

      {/* Repos Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredRepos.map((repo) => {
          const isSelected = activeRepo?.id === repo.id;
          return (
            <div
              key={repo.id}
              className={`bg-[#161b22] border rounded-xl p-4 flex flex-col justify-between transition-colors shadow-xs ${
                isSelected ? 'border-emerald-500/50 bg-[#161b22]' : 'border-[#30363d] hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {repo.private ? (
                      <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : (
                      <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    )}
                    <h3
                      onClick={() => onSelectRepo(repo)}
                      className="font-semibold text-sm text-slate-100 hover:text-emerald-400 cursor-pointer truncate transition-colors"
                    >
                      {repo.name}
                    </h3>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={repo.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#21262d]"
                      title="Open on GitHub"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={() => onOpenRepoDelete(repo)}
                      className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-950/30"
                      title="Delete repo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px] mb-3">
                  {repo.description || 'No description provided.'}
                </p>

                <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono mb-4">
                  {repo.language && (
                    <span className="flex items-center gap-1 font-sans">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                      {repo.language}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    {repo.default_branch}
                  </span>
                  {repo.stargazers_count > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-400" />
                      {repo.stargazers_count}
                    </span>
                  )}
                  <span>{(repo.size / 1024).toFixed(1)} MB</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="pt-3 border-t border-[#21262d] flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectRepo(repo)}
                  className="px-2.5 py-1 text-xs font-semibold text-slate-200 hover:text-white bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors flex items-center gap-1.5"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                  File Manager
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => onOpenZipForRepo(repo)}
                    className="px-2 py-1 text-xs text-slate-300 hover:text-white bg-[#21262d] hover:bg-[#30363d] rounded border border-[#30363d] transition-colors flex items-center gap-1"
                    title="Upload & extract ZIP into this repo"
                  >
                    <FileArchive className="w-3 h-3 text-amber-400" />
                    Extract ZIP
                  </button>
                  <button
                    onClick={() => onOpenWorkflowsForRepo(repo)}
                    className="px-2 py-1 text-xs text-slate-300 hover:text-white bg-[#21262d] hover:bg-[#30363d] rounded border border-[#30363d] transition-colors flex items-center gap-1"
                    title="Workflows & CI"
                  >
                    <PlaySquare className="w-3 h-3 text-blue-400" />
                    Workflows
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

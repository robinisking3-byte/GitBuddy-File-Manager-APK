import React from 'react';
import {
  FolderGit2,
  PlaySquare,
  FileArchive,
  Code2,
  FolderOpen,
  KeyRound,
  GitBranch,
  ChevronDown,
  RefreshCw,
  ExternalLink,
  Smartphone,
  Download,
  GitCommit,
} from 'lucide-react';
import { GitHubUser, GitHubRepo, RepoBranch } from '../types/github';

interface NavbarProps {
  activeTab: 'files' | 'workflows' | 'zip' | 'repos' | 'commits';
  setActiveTab: (tab: 'files' | 'workflows' | 'zip' | 'repos' | 'commits') => void;
  user: GitHubUser | null;
  activeRepo: GitHubRepo | null;
  activeBranch: string;
  branches: RepoBranch[];
  onSelectBranch: (branch: string) => void;
  onOpenRepoSelector: () => void;
  onOpenTokenSettings: () => void;
  onOpenAccountsModal: () => void;
  onOpenDownloadApk: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  user,
  activeRepo,
  activeBranch,
  branches,
  onSelectBranch,
  onOpenRepoSelector,
  onOpenTokenSettings,
  onOpenAccountsModal,
  onOpenDownloadApk,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#161b22] border-b border-[#30363d] px-4 lg:px-6 py-2.5">
      <div className="flex items-center justify-between gap-6 max-w-7xl mx-auto">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => setActiveTab('files')}>
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-emerald-500/30 flex items-center justify-center bg-[#0d1117] shadow-sm ring-1 ring-emerald-500/20">
              <img src="/logo.svg" alt="GitBuddy Logo" className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white leading-tight">
                GitBuddy
              </span>
              <span className="text-[10px] text-emerald-400 font-medium tracking-wide">
                Actions & CI
              </span>
            </div>
          </div>

          {/* Active Repo Quick Selector */}
          {activeRepo && (
            <div className="hidden sm:flex items-center gap-1.5 ml-2 pl-3 border-l border-[#30363d]">
              <button
                onClick={onOpenRepoSelector}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-200 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors"
                title="Switch repository"
              >
                <span className="text-slate-400 font-normal">{activeRepo.owner?.login || activeRepo.full_name.split('/')[0]} /</span>
                <span className="font-semibold text-emerald-400 truncate max-w-[140px]">{activeRepo.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>

              {/* Branch Selector */}
              {branches.length > 0 && (
                <div className="relative">
                  <select
                    value={activeBranch}
                    onChange={(e) => onSelectBranch(e.target.value)}
                    className="appearance-none pl-6 pr-6 py-1 text-xs font-mono bg-[#21262d] hover:bg-[#30363d] text-slate-300 border border-[#30363d] rounded-md cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {branches.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                  <GitBranch className="w-3 h-3 text-slate-400 absolute left-2 top-2 pointer-events-none" />
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Zone 2: Navigation Links (Clean single-line text tabs) */}
        <nav className="hidden md:flex items-center gap-1 text-sm font-medium">
          <button
            onClick={() => setActiveTab('files')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'files'
                ? 'bg-[#21262d] text-white shadow-sm border border-[#30363d]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderOpen className="w-3.5 h-3.5" />
            File Manager
          </button>

          <button
            onClick={() => setActiveTab('commits')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'commits'
                ? 'bg-[#21262d] text-white shadow-sm border border-[#30363d]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
            Commits
          </button>

          <button
            onClick={() => setActiveTab('zip')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'zip'
                ? 'bg-[#21262d] text-white shadow-sm border border-[#30363d]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileArchive className="w-3.5 h-3.5" />
            ZIP & Batch Upload
          </button>

          <button
            onClick={() => setActiveTab('workflows')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'workflows'
                ? 'bg-[#21262d] text-white shadow-sm border border-[#30363d]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <PlaySquare className="w-3.5 h-3.5" />
            Workflows & CI
          </button>

          <button
            onClick={() => setActiveTab('repos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              activeTab === 'repos'
                ? 'bg-[#21262d] text-white shadow-sm border border-[#30363d]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            Repositories
          </button>
        </nav>

        {/* Zone 3: Primary Action & Profile */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onOpenDownloadApk}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-400/30 rounded-md shadow-xs transition-all active:scale-95"
            title="Download Production Android APK"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-200" />
            <span>Download APK</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#21262d] rounded-md transition-colors"
            title="Refresh active state"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <button
            onClick={onOpenAccountsModal}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-200 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors"
            title="Manage Multiple PAT Accounts in Database"
          >
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Accounts</span>
          </button>

          {user ? (
            <button
              onClick={onOpenAccountsModal}
              className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors"
              title="GitHub Account & Switcher"
            >
              <img
                src={user.avatar_url}
                alt={user.login}
                className="w-5 h-5 rounded-full ring-1 ring-emerald-500/50"
                referrerPolicy="no-referrer"
              />
              <span className="text-xs font-medium text-slate-200 truncate max-w-[100px]">{user.login}</span>
            </button>
          ) : (
            <button
              onClick={onOpenAccountsModal}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Login PAT
            </button>
          )}

          {activeRepo && (
            <a
              href={activeRepo.html_url}
              target="_blank"
              rel="noreferrer"
              className="hidden lg:flex items-center gap-1 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#21262d] rounded-md transition-colors text-xs"
              title="Open repository on GitHub"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Mobile view navigation row */}
      <div className="flex md:hidden items-center gap-2 overflow-x-auto pt-2 mt-2 border-t border-[#21262d] text-xs">
        <button
          onClick={() => setActiveTab('files')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'files' ? 'bg-[#21262d] text-white font-medium' : 'text-slate-400'
          }`}
        >
          Files
        </button>
        <button
          onClick={() => setActiveTab('commits')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'commits' ? 'bg-[#21262d] text-white font-medium' : 'text-slate-400'
          }`}
        >
          Commits
        </button>
        <button
          onClick={() => setActiveTab('zip')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'zip' ? 'bg-[#21262d] text-white font-medium' : 'text-slate-400'
          }`}
        >
          ZIP Extract
        </button>
        <button
          onClick={() => setActiveTab('workflows')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'workflows' ? 'bg-[#21262d] text-white font-medium' : 'text-slate-400'
          }`}
        >
          Workflows
        </button>
        <button
          onClick={() => setActiveTab('repos')}
          className={`px-2.5 py-1 rounded whitespace-nowrap ${
            activeTab === 'repos' ? 'bg-[#21262d] text-white font-medium' : 'text-slate-400'
          }`}
        >
          Repos
        </button>
      </div>
    </header>
  );
};

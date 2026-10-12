import React, { useState, useEffect, useCallback } from 'react';
import {
  GitCommit,
  GitBranch,
  Search,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  Clock,
  ShieldCheck,
  FileCode,
  FileDiff,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
  Calendar,
  Layers,
  ArrowRight,
  FolderGit2,
} from 'lucide-react';
import { GitHubRepo, RepoBranch, GitCommitItem, GitCommitFile } from '../types/github';
import { githubApi } from '../services/githubApi';

interface CommitHistoryProps {
  repo: GitHubRepo;
  branch: string;
  token: string;
  branches?: RepoBranch[];
  onSelectBranch?: (branch: string) => void;
  embedded?: boolean;
}

// Utility: format relative time
function formatRelativeTime(dateString: string): string {
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSeconds < 60) return 'just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths}mo ago`;
    const diffYears = Math.floor(diffDays / 365);
    return `${diffYears}y ago`;
  } catch {
    return dateString;
  }
}

function formatFullDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return dateString;
  }
}

export const CommitHistory: React.FC<CommitHistoryProps> = ({
  repo,
  branch,
  token,
  branches = [],
  onSelectBranch,
  embedded = false,
}) => {
  const [commits, setCommits] = useState<GitCommitItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Expanded messages state
  const [expandedCommitShas, setExpandedCommitShas] = useState<Set<string>>(new Set());

  // Copy SHA feedback
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  // Inspected commit details modal
  const [inspectedCommitSha, setInspectedCommitSha] = useState<string | null>(null);
  const [inspectedCommitData, setInspectedCommitData] = useState<GitCommitItem | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);

  const [owner, repoName] = repo.full_name ? repo.full_name.split('/') : [repo.owner?.login || '', repo.name];

  const fetchCommits = useCallback(
    async (targetPage = 1, append = false) => {
      if (!token) {
        setError('GitHub PAT Token is required to fetch commit history.');
        setIsLoading(false);
        return;
      }

      if (targetPage === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      setError(null);

      try {
        const fetched = await githubApi.getCommits(token, owner, repoName, {
          sha: branch,
          per_page: 30,
          page: targetPage,
        });

        if (append) {
          setCommits((prev) => [...prev, ...fetched]);
        } else {
          setCommits(fetched);
        }

        setHasMore(fetched.length === 30);
        setPage(targetPage);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(`Failed to load commit history: ${msg}`);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [token, owner, repoName, branch]
  );

  useEffect(() => {
    fetchCommits(1, false);
  }, [fetchCommits]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchCommits(1, false);
  };

  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore) {
      fetchCommits(page + 1, true);
    }
  };

  const toggleExpand = (sha: string) => {
    setExpandedCommitShas((prev) => {
      const next = new Set(prev);
      if (next.has(sha)) {
        next.delete(sha);
      } else {
        next.add(sha);
      }
      return next;
    });
  };

  const handleCopySha = (sha: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => {
      setCopiedSha((curr) => (curr === sha ? null : curr));
    }, 2000);
  };

  // Inspect detailed changes of a commit
  const handleInspectCommit = async (sha: string) => {
    setInspectedCommitSha(sha);
    setIsLoadingDetails(true);
    setInspectedCommitData(null);

    try {
      const detail = await githubApi.getCommit(token, owner, repoName, sha);
      setInspectedCommitData(detail);
    } catch (err: unknown) {
      console.warn('Could not load detailed commit diffs:', err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Filtered commits
  const filteredCommits = commits.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const msg = c.commit?.message?.toLowerCase() || '';
    const author = (c.author?.login || c.commit?.author?.name || '').toLowerCase();
    const sha = c.sha?.toLowerCase() || '';
    return msg.includes(q) || author.includes(q) || sha.includes(q);
  });

  return (
    <div className="space-y-4">
      {/* Top Controls Header */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <GitCommit className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-white tracking-tight">Recent Commit History</h2>
              <span className="px-2 py-0.5 text-[11px] font-mono font-medium rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                {commits.length} {commits.length === 1 ? 'commit' : 'commits'}
              </span>
            </div>
            <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
              <span>Repository:</span>
              <span className="font-mono text-slate-300 font-medium">{repo.full_name}</span>
              <span>•</span>
              <span className="flex items-center gap-1 font-mono text-emerald-400">
                <GitBranch className="w-3 h-3" />
                {branch}
              </span>
            </p>
          </div>
        </div>

        {/* Branch selector & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {branches.length > 0 && onSelectBranch && (
            <div className="relative">
              <select
                value={branch}
                onChange={(e) => onSelectBranch(e.target.value)}
                className="appearance-none pl-6 pr-6 py-1.5 text-xs font-mono bg-[#21262d] hover:bg-[#30363d] text-slate-300 border border-[#30363d] rounded-md cursor-pointer focus:outline-none focus:ring-1 focus:ring-emerald-500"
                title="Switch branch to view commit history"
              >
                {branches.map((b) => (
                  <option key={b.name} value={b.name}>
                    {b.name}
                  </option>
                ))}
              </select>
              <GitBranch className="w-3 h-3 text-slate-400 absolute left-2 top-2.5 pointer-events-none" />
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-2.5 pointer-events-none" />
            </div>
          )}

          <div className="relative flex-1 sm:w-60">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search message, author, SHA..."
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="p-1.5 text-slate-300 hover:text-white bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors"
            title="Refresh commit history"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
          </button>

          <a
            href={`https://github.com/${owner}/${repoName}/commits/${branch}`}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors flex items-center gap-1.5"
            title="Open commits on GitHub.com"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">GitHub</span>
          </a>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-xl text-xs text-rose-300 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-rose-200">Commit Load Error</div>
              <p className="mt-0.5 text-rose-300/90">{error}</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="px-2.5 py-1 text-xs bg-rose-900/60 hover:bg-rose-800 border border-rose-500/50 rounded text-white shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Main Commit Feed */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
            <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
            <span className="font-medium text-slate-300">Fetching commit history from GitHub...</span>
            <span className="text-slate-500 font-mono text-[11px]">{repo.full_name} @ {branch}</span>
          </div>
        ) : filteredCommits.length === 0 ? (
          <div className="p-14 text-center text-slate-400 text-xs space-y-3">
            <FolderGit2 className="w-10 h-10 text-slate-600 mx-auto" />
            <div>
              <h3 className="text-sm font-semibold text-slate-200">No Commits Found</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                {searchQuery
                  ? `No commits matched your filter "${searchQuery}".`
                  : `There are no recorded commits yet on branch "${branch}".`}
              </p>
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-3 py-1 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Clear filter
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#21262d]">
            {filteredCommits.map((item, index) => {
              const fullMsg = item.commit.message || '';
              const [firstLine, ...restLines] = fullMsg.split('\n');
              const body = restLines.join('\n').trim();
              const hasBody = body.length > 0;
              const isExpanded = expandedCommitShas.has(item.sha);
              const authorName = item.author?.login || item.commit.author?.name || 'Author';
              const authorAvatar = item.author?.avatar_url;
              const authorDate = item.commit.author?.date;
              const shortSha = item.sha.slice(0, 7);
              const isVerified = item.commit.verification?.verified;
              const committerDiffers =
                item.committer?.login &&
                item.author?.login &&
                item.committer.login.toLowerCase() !== item.author.login.toLowerCase();

              return (
                <div
                  key={item.sha}
                  className="p-4 hover:bg-[#1f242c]/70 transition-colors group flex flex-col md:flex-row md:items-start justify-between gap-3"
                >
                  {/* Left: Commit info & message */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Author Avatar or Initial Placeholder */}
                    <div className="mt-0.5 shrink-0">
                      {authorAvatar ? (
                        <img
                          src={authorAvatar}
                          alt={authorName}
                          className="w-8 h-8 rounded-full border border-[#30363d] bg-[#0d1117] object-cover ring-1 ring-slate-700/50"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center justify-center font-bold text-xs uppercase">
                          {authorName.slice(0, 2)}
                        </div>
                      )}
                    </div>

                    {/* Commit Content */}
                    <div className="min-w-0 flex-1 space-y-1">
                      {/* Commit Headline */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => handleInspectCommit(item.sha)}
                          className="text-xs sm:text-sm font-semibold text-slate-100 hover:text-emerald-400 text-left transition-colors font-mono tracking-tight break-words group-hover:underline"
                        >
                          {firstLine}
                        </button>

                        {hasBody && (
                          <button
                            onClick={() => toggleExpand(item.sha)}
                            className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 hover:text-white bg-[#21262d] rounded border border-[#30363d] transition-colors inline-flex items-center gap-0.5"
                            title={isExpanded ? 'Collapse commit body' : 'Expand commit body'}
                          >
                            <span>...</span>
                            {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                          </button>
                        )}

                        {isVerified && (
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-500/40 rounded-full"
                            title="Commit GPG signature is verified by GitHub"
                          >
                            <ShieldCheck className="w-3 h-3" />
                            Verified
                          </span>
                        )}
                      </div>

                      {/* Expandable Body */}
                      {hasBody && isExpanded && (
                        <div className="mt-2 p-3 bg-[#0d1117] border border-[#30363d] rounded-lg text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {body}
                        </div>
                      )}

                      {/* Author & Timestamp meta line */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                        {item.author?.html_url ? (
                          <a
                            href={item.author.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-slate-300 hover:text-emerald-400 hover:underline"
                          >
                            {authorName}
                          </a>
                        ) : (
                          <span className="font-medium text-slate-300">{authorName}</span>
                        )}

                        {committerDiffers && item.committer && (
                          <span className="text-slate-500 text-[10px]">
                            (committed by <span className="text-slate-400 font-medium">{item.committer.login}</span>)
                          </span>
                        )}

                        <span>•</span>

                        <span
                          className="flex items-center gap-1 text-slate-400 hover:text-slate-200 cursor-help"
                          title={authorDate ? formatFullDate(authorDate) : ''}
                        >
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{authorDate ? formatRelativeTime(authorDate) : 'recently'}</span>
                        </span>

                        {authorDate && (
                          <span className="hidden sm:inline text-slate-500 text-[10px]">
                            ({formatFullDate(authorDate)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Commit SHA badge & Quick Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-start md:self-center ml-11 md:ml-0">
                    <button
                      onClick={(e) => handleCopySha(item.sha, e)}
                      className="px-2 py-1 text-xs font-mono font-medium text-slate-300 hover:text-white bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] rounded-md transition-colors flex items-center gap-1.5 shadow-xs"
                      title="Copy full commit SHA"
                    >
                      <span>{shortSha}</span>
                      {copiedSha === item.sha ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3 text-slate-500 group-hover:text-slate-400" />
                      )}
                    </button>

                    <button
                      onClick={() => handleInspectCommit(item.sha)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors flex items-center gap-1"
                      title="Inspect commit file changes & diffs"
                    >
                      <FileDiff className="w-3.5 h-3.5 text-blue-400" />
                      <span className="hidden lg:inline">Inspect</span>
                    </button>

                    <a
                      href={item.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1 text-slate-400 hover:text-slate-200 hover:bg-[#21262d] rounded-md transition-colors"
                      title="View commit directly on GitHub"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More Pagination */}
        {!isLoading && filteredCommits.length > 0 && hasMore && (
          <div className="p-4 bg-[#161b22] border-t border-[#30363d] text-center">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-lg transition-colors inline-flex items-center gap-2 shadow-xs"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Loading older commits...</span>
                </>
              ) : (
                <>
                  <span>Load More Commits</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Detailed Commit Inspector Modal */}
      {inspectedCommitSha && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-[#30363d] flex items-center justify-between gap-3 bg-[#0d1117]">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <FileDiff className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">Commit Details</h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#21262d] text-emerald-400 border border-[#30363d]">
                      {inspectedCommitSha.slice(0, 7)}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    {repo.full_name} @ {branch}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`https://github.com/${owner}/${repoName}/commit/${inspectedCommitSha}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open on GitHub</span>
                </a>
                <button
                  onClick={() => {
                    setInspectedCommitSha(null);
                    setInspectedCommitData(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-[#21262d] rounded-md transition-colors text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
              {isLoadingDetails ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400 text-xs">
                  <Loader2 className="w-7 h-7 animate-spin text-emerald-400" />
                  <span>Loading commit changes, stats, and diffs...</span>
                </div>
              ) : inspectedCommitData ? (
                <>
                  {/* Headline & Stats Bar */}
                  <div className="p-4 bg-[#0d1117] border border-[#30363d] rounded-xl space-y-2">
                    <h4 className="text-sm font-semibold text-white whitespace-pre-wrap font-mono">
                      {inspectedCommitData.commit.message}
                    </h4>

                    <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-[#21262d] text-xs">
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>Authored by <strong className="text-slate-200">{inspectedCommitData.commit.author.name}</strong></span>
                        <span>•</span>
                        <span>{formatFullDate(inspectedCommitData.commit.author.date)}</span>
                      </div>

                      {inspectedCommitData.stats && (
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className="text-emerald-400 font-medium">+{inspectedCommitData.stats.additions}</span>
                          <span className="text-rose-400 font-medium">-{inspectedCommitData.stats.deletions}</span>
                          <span className="text-slate-400">({inspectedCommitData.files?.length || 0} files)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Changed Files List */}
                  {inspectedCommitData.files && inspectedCommitData.files.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                        <span>Changed Files ({inspectedCommitData.files.length})</span>
                      </div>

                      <div className="space-y-2">
                        {inspectedCommitData.files.map((file) => (
                          <div
                            key={file.filename}
                            className="bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-xs space-y-2"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 font-mono text-slate-200">
                                <FileCode className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <span className="font-semibold break-all">{file.filename}</span>
                                <span
                                  className={`px-1.5 py-0.2 text-[10px] uppercase font-bold rounded ${
                                    file.status === 'added'
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                      : file.status === 'removed'
                                      ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                                      : 'bg-blue-950 text-blue-400 border border-blue-500/30'
                                  }`}
                                >
                                  {file.status}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 font-mono text-[11px]">
                                <span className="text-emerald-400">+{file.additions}</span>
                                <span className="text-rose-400">-{file.deletions}</span>
                              </div>
                            </div>

                            {/* Patch diff preview */}
                            {file.patch && (
                              <pre className="p-3 bg-[#161b22] border border-[#30363d] rounded-md font-mono text-[11px] overflow-x-auto text-slate-300 max-h-56 overflow-y-auto leading-relaxed">
                                {file.patch.split('\n').map((line, lIdx) => {
                                  let colorClass = 'text-slate-300';
                                  if (line.startsWith('+')) colorClass = 'text-emerald-400 bg-emerald-950/30';
                                  else if (line.startsWith('-')) colorClass = 'text-rose-400 bg-rose-950/30';
                                  else if (line.startsWith('@@')) colorClass = 'text-cyan-400 font-semibold';

                                  return (
                                    <div key={lIdx} className={colorClass}>
                                      {line}
                                    </div>
                                  );
                                })}
                              </pre>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  Could not load commit details.
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 sm:p-4 border-t border-[#30363d] bg-[#0d1117] flex justify-end">
              <button
                onClick={() => {
                  setInspectedCommitSha(null);
                  setInspectedCommitData(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

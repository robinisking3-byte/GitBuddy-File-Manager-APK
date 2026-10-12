import React, { useState } from 'react';
import {
  Folder,
  FileCode,
  FileText,
  Image as ImageIcon,
  FileArchive,
  Download,
  Trash2,
  Edit3,
  Eye,
  Plus,
  FolderPlus,
  Upload,
  Search,
  LayoutGrid,
  List,
  ChevronRight,
  FolderUp,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  File,
  PlaySquare,
  GitCommit,
} from 'lucide-react';
import { RepoContentItem, GitHubRepo } from '../types/github';
import { createZipFromFiles } from '../utils/zipHandler';
import { githubApi, base64ToUtf8 } from '../services/githubApi';
import { CommitHistory } from './CommitHistory';

interface FileManagerProps {
  repo: GitHubRepo;
  branch: string;
  token: string;
  currentPath: string;
  contents: RepoContentItem[];
  isLoading: boolean;
  onNavigatePath: (path: string) => void;
  onOpenFileViewer: (item: RepoContentItem) => void;
  onOpenFileEditor: (item: RepoContentItem) => void;
  onOpenCreateFile: (targetFolder: string) => void;
  onOpenZipExtractor: () => void;
  onOpenBatchUpload: () => void;
  onRefreshDirectory: () => void;
  onOpenWorkflows?: () => void;
  onOpenCommits?: () => void;
}

export const FileManager: React.FC<FileManagerProps> = ({
  repo,
  branch,
  token,
  currentPath,
  contents,
  isLoading,
  onNavigatePath,
  onOpenFileViewer,
  onOpenFileEditor,
  onOpenCreateFile,
  onOpenZipExtractor,
  onOpenBatchUpload,
  onRefreshDirectory,
  onOpenWorkflows,
  onOpenCommits,
}) => {
  const [activeSubView, setActiveSubView] = useState<'files' | 'commits'>('files');
  const [searchFilter, setSearchFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [itemToDelete, setItemToDelete] = useState<RepoContentItem | null>(null);
  const [deleteCommitMsg, setDeleteCommitMsg] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const [isDragOverWindow, setIsDragOverWindow] = useState(false);

  // Split path into segments for breadcrumb navigation
  const pathSegments = currentPath.split('/').filter(Boolean);

  const getBreadcrumbUrl = (index: number) => {
    return pathSegments.slice(0, index + 1).join('/');
  };

  const getParentPath = () => {
    if (pathSegments.length <= 1) return '';
    return pathSegments.slice(0, -1).join('/');
  };

  // Filter items based on search term
  const filteredContents = contents.filter((item) =>
    item.name.toLowerCase().includes(searchFilter.toLowerCase())
  );

  // Sort directories first, then alphabetical
  const sortedContents = [...filteredContents].sort((a, b) => {
    if (a.type === 'dir' && b.type !== 'dir') return -1;
    if (a.type !== 'dir' && b.type === 'dir') return 1;
    return a.name.localeCompare(b.name);
  });

  const getFileIcon = (item: RepoContentItem) => {
    if (item.type === 'dir') {
      return <Folder className="w-4 h-4 text-emerald-400 shrink-0" />;
    }
    const ext = item.name.split('.').pop()?.toLowerCase();
    if (ext === 'zip' || ext === 'tar' || ext === 'gz') {
      return <FileArchive className="w-4 h-4 text-amber-400 shrink-0" />;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) {
      return <ImageIcon className="w-4 h-4 text-purple-400 shrink-0" />;
    }
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'dart', 'html', 'css', 'json', 'yaml', 'yml'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-blue-400 shrink-0" />;
    }
    if (['md', 'txt', 'rst'].includes(ext || '')) {
      return <FileText className="w-4 h-4 text-slate-300 shrink-0" />;
    }
    return <File className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  const handleDownloadItem = async (item: RepoContentItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === 'file') {
      if (item.download_url) {
        window.open(item.download_url, '_blank');
      } else {
        // Fetch content
        const data = await githubApi.getContents(token, repo.owner.login, repo.name, item.path, branch);
        if (!Array.isArray(data) && data.content) {
          const text = base64ToUtf8(data.content);
          const blob = new Blob([text], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = item.name;
          a.click();
          URL.revokeObjectURL(url);
        }
      }
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const [owner, repoName] = repo.full_name.split('/');
      await githubApi.deleteFile(
        token,
        owner,
        repoName,
        itemToDelete.path,
        itemToDelete.sha,
        deleteCommitMsg || `Delete ${itemToDelete.name} via GitBuddy`,
        branch
      );
      setItemToDelete(null);
      setDeleteCommitMsg('');
      onRefreshDirectory();
    } catch (err: unknown) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    try {
      const cleanName = newFolderName.trim().replace(/^\/+|\/+$/g, '');
      const folderPath = currentPath ? `${currentPath}/${cleanName}` : cleanName;
      const keepFilePath = `${folderPath}/.gitkeep`;

      const [owner, repoName] = repo.full_name.split('/');
      await githubApi.createOrUpdateFile(
        token,
        owner,
        repoName,
        keepFilePath,
        btoa(''),
        `Create folder ${cleanName}/ via GitBuddy`,
        undefined,
        branch
      );

      setIsCreatingFolder(false);
      setNewFolderName('');
      onRefreshDirectory();
    } catch (err: unknown) {
      alert(`Create folder failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleDownloadDirectoryZip = async () => {
    setIsDownloadingZip(true);
    try {
      // Gather current directory files
      const [owner, repoName] = repo.full_name.split('/');
      const filesToBundle: { path: string; content: string }[] = [];

      for (const item of contents) {
        if (item.type === 'file') {
          const fileData = await githubApi.getContents(token, owner, repoName, item.path, branch);
          if (!Array.isArray(fileData) && fileData.content) {
            filesToBundle.push({
              path: item.name,
              content: base64ToUtf8(fileData.content),
            });
          }
        }
      }

      if (filesToBundle.length === 0) {
        alert('No files in this directory to download.');
        return;
      }

      const zipBlob = await createZipFromFiles(filesToBundle);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${repo.name}-${pathSegments[pathSegments.length - 1] || 'root'}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(`Export ZIP failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOverWindow(true);
      }}
      onDragLeave={() => setIsDragOverWindow(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOverWindow(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const hasZip = Array.from(e.dataTransfer.files).some((f) => f.name.endsWith('.zip'));
          if (hasZip) {
            onOpenZipExtractor();
          } else {
            onOpenBatchUpload();
          }
        }
      }}
      className="space-y-4 relative"
    >
      {/* Drag & Drop Overlay */}
      {isDragOverWindow && (
        <div className="absolute inset-0 z-30 bg-emerald-950/80 border-2 border-dashed border-emerald-400 rounded-xl flex flex-col items-center justify-center p-6 backdrop-blur-xs text-white pointer-events-none">
          <Upload className="w-12 h-12 text-emerald-400 animate-bounce mb-2" />
          <h3 className="text-base font-semibold">Drop Files or Folders into GitBuddy</h3>
          <p className="text-xs text-emerald-200">
            Will upload preserving relative hierarchy into /{currentPath || ''}
          </p>
        </div>
      )}

      {/* File Manager View Mode Switcher: Files Explorer vs Recent Commit History */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-2 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveSubView('files')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSubView === 'files'
                ? 'bg-[#21262d] text-white border border-[#30363d] shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-emerald-400" />
            <span>Files Explorer</span>
          </button>

          <button
            onClick={() => setActiveSubView('commits')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeSubView === 'commits'
                ? 'bg-[#21262d] text-white border border-[#30363d] shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
            <span>Commit History</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeSubView === 'files' ? (
            <button
              onClick={() => setActiveSubView('commits')}
              className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors hidden sm:flex"
            >
              <span>Recent commits on</span>
              <span className="font-mono text-emerald-400 font-semibold">{branch}</span>
              <ArrowLeft className="w-3 h-3 rotate-180" />
            </button>
          ) : (
            <button
              onClick={() => setActiveSubView('files')}
              className="text-xs text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors hidden sm:flex"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Files</span>
            </button>
          )}
        </div>
      </div>

      {activeSubView === 'commits' ? (
        <CommitHistory
          repo={repo}
          branch={branch}
          token={token}
          embedded={true}
        />
      ) : (
        <>
          {/* Breadcrumbs Navigation & Actions Bar */}
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        {/* Breadcrumb Trail */}
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto py-1">
          {currentPath && (
            <button
              onClick={() => onNavigatePath(getParentPath())}
              className="p-1 text-slate-400 hover:text-white hover:bg-[#21262d] rounded transition-colors mr-1"
              title="Go to parent directory"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => onNavigatePath('')}
            className={`font-semibold hover:text-emerald-400 transition-colors flex items-center gap-1 ${
              currentPath === '' ? 'text-emerald-400' : 'text-slate-300'
            }`}
          >
            <Folder className="w-3.5 h-3.5 text-emerald-400" />
            <span>{repo.name}</span>
          </button>

          {pathSegments.map((segment, idx) => {
            const isLast = idx === pathSegments.length - 1;
            const segmentPath = getBreadcrumbUrl(idx);
            return (
              <React.Fragment key={idx}>
                <ChevronRight className="w-3 h-3 text-slate-600 shrink-0" />
                <button
                  onClick={() => onNavigatePath(segmentPath)}
                  className={`hover:text-emerald-400 transition-colors font-mono truncate max-w-[120px] ${
                    isLast ? 'text-emerald-400 font-semibold' : 'text-slate-300'
                  }`}
                >
                  {segment}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Primary Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {onOpenWorkflows && (
            <button
              onClick={onOpenWorkflows}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600/90 hover:bg-blue-500 rounded-md transition-colors flex items-center gap-1.5 shadow-xs"
              title="View repository workflows, live logs and build artifacts (APKs)"
            >
              <PlaySquare className="w-3.5 h-3.5 text-blue-200" />
              <span>Workflows & APKs</span>
            </button>
          )}

          <button
            onClick={onOpenZipExtractor}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-1.5 shadow-xs"
            title="Upload ZIP and unpack into repository maintaining folder hierarchy"
          >
            <FileArchive className="w-3.5 h-3.5" />
            <span>Upload & Extract ZIP</span>
          </button>

          <button
            onClick={onOpenBatchUpload}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors flex items-center gap-1.5"
            title="Drag and drop batch files or whole folders"
          >
            <FolderUp className="w-3.5 h-3.5 text-emerald-400" />
            <span>Batch Upload</span>
          </button>

          <button
            onClick={() => onOpenCreateFile(currentPath)}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors flex items-center gap-1.5"
            title="Create a new file in this directory"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-400" />
            <span>New File</span>
          </button>

          <button
            onClick={() => setIsCreatingFolder(true)}
            className="px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors flex items-center gap-1.5"
            title="Create a new subfolder"
          >
            <FolderPlus className="w-3.5 h-3.5 text-emerald-400" />
            <span>New Folder</span>
          </button>

          <button
            onClick={handleDownloadDirectoryZip}
            disabled={isDownloadingZip}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-[#21262d] rounded-md transition-colors border border-transparent hover:border-[#30363d]"
            title="Download directory as ZIP"
          >
            {isDownloadingZip ? <Loader2 className="w-4 h-4 animate-spin text-emerald-400" /> : <Download className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* New Folder Inline Form */}
      {isCreatingFolder && (
        <form
          onSubmit={handleCreateFolder}
          className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 flex items-center gap-2 text-xs"
        >
          <FolderPlus className="w-4 h-4 text-emerald-400 shrink-0" />
          <input
            type="text"
            required
            autoFocus
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="Folder name (e.g. components, assets)"
            className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2.5 py-1 text-slate-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            type="submit"
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => setIsCreatingFolder(false)}
            className="px-2 py-1 text-slate-400 hover:text-white"
          >
            Cancel
          </button>
        </form>
      )}

      {/* Delete Item Confirmation Drawer */}
      {itemToDelete && (
        <div className="bg-rose-950/40 border border-rose-500/40 rounded-xl p-4 text-xs space-y-3">
          <div className="flex items-center gap-2 text-rose-300 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Delete file &quot;{itemToDelete.path}&quot;?</span>
          </div>
          <div>
            <label className="block text-[11px] text-slate-400 mb-1">Commit Message</label>
            <input
              type="text"
              value={deleteCommitMsg}
              onChange={(e) => setDeleteCommitMsg(e.target.value)}
              placeholder={`Delete ${itemToDelete.name}`}
              className="w-full bg-[#0d1117] border border-[#30363d] rounded px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setItemToDelete(null)}
              className="px-3 py-1 text-slate-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={isDeleting}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded font-semibold flex items-center gap-1.5"
            >
              {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              Delete File
            </button>
          </div>
        </div>
      )}

      {/* Filter and View Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search in this folder..."
            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1 bg-[#161b22] border border-[#30363d] rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('table')}
            className={`p-1 rounded transition-colors ${
              viewMode === 'table' ? 'bg-[#21262d] text-white' : 'text-slate-400 hover:text-white'
            }`}
            title="List Table View"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1 rounded transition-colors ${
              viewMode === 'grid' ? 'bg-[#21262d] text-white' : 'text-slate-400 hover:text-white'
            }`}
            title="Grid Icon View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content View: Table or Grid */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Fetching repository files...</span>
          </div>
        ) : sortedContents.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-3">
            <Folder className="w-10 h-10 text-slate-600 mx-auto" />
            <p>This directory is currently empty or contains no matching files.</p>
            <div className="flex justify-center gap-2">
              <button
                onClick={onOpenZipExtractor}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors"
              >
                Extract ZIP into here
              </button>
              <button
                onClick={() => onOpenCreateFile(currentPath)}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-[#21262d] hover:bg-[#30363d] rounded-md transition-colors"
              >
                Create First File
              </button>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0d1117]/80 text-slate-400 border-b border-[#30363d]">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Name</th>
                  <th className="py-2.5 px-4 font-medium hidden sm:table-cell">Type</th>
                  <th className="py-2.5 px-4 font-medium text-right">Size</th>
                  <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d]">
                {/* Back to parent row if nested */}
                {currentPath && (
                  <tr
                    onClick={() => onNavigatePath(getParentPath())}
                    className="hover:bg-[#21262d]/60 cursor-pointer text-slate-400"
                  >
                    <td className="py-2 px-4 flex items-center gap-2">
                      <Folder className="w-4 h-4 text-emerald-400" />
                      <span className="font-mono">..</span>
                    </td>
                    <td className="py-2 px-4 hidden sm:table-cell">Parent Directory</td>
                    <td className="py-2 px-4 text-right">—</td>
                    <td className="py-2 px-4 text-right"></td>
                  </tr>
                )}

                {sortedContents.map((item) => {
                  const isDir = item.type === 'dir';
                  return (
                    <tr
                      key={item.sha || item.path}
                      onClick={() => {
                        if (isDir) onNavigatePath(item.path);
                        else onOpenFileViewer(item);
                      }}
                      className="hover:bg-[#21262d]/70 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(item)}
                          <span
                            className={`font-mono truncate max-w-xs md:max-w-md ${
                              isDir ? 'text-slate-100 font-semibold group-hover:text-emerald-400' : 'text-slate-200'
                            }`}
                          >
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400 hidden sm:table-cell">
                        {isDir ? 'Directory' : item.name.split('.').pop()?.toUpperCase() || 'File'}
                      </td>
                      <td className="py-2.5 px-4 text-right text-slate-400 tabular-nums">
                        {isDir ? '—' : `${(item.size / 1024).toFixed(1)} KB`}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {!isDir && (
                            <>
                              <button
                                onClick={() => onOpenFileViewer(item)}
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#30363d]"
                                title="View contents"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onOpenFileEditor(item)}
                                className="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-[#30363d]"
                                title="Edit file directly"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDownloadItem(item, e)}
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#30363d]"
                                title="Download file"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => {
                              setItemToDelete(item);
                              setDeleteCommitMsg(`Delete ${item.name} via GitBuddy`);
                            }}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-950/40"
                            title="Delete file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {currentPath && (
              <div
                onClick={() => onNavigatePath(getParentPath())}
                className="p-3 bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] rounded-lg cursor-pointer flex flex-col items-center justify-center text-center transition-colors group"
              >
                <Folder className="w-8 h-8 text-emerald-400 mb-1.5" />
                <span className="text-xs font-mono text-slate-400">.. (Parent)</span>
              </div>
            )}

            {sortedContents.map((item) => {
              const isDir = item.type === 'dir';
              return (
                <div
                  key={item.sha || item.path}
                  onClick={() => {
                    if (isDir) onNavigatePath(item.path);
                    else onOpenFileViewer(item);
                  }}
                  className="p-3 bg-[#0d1117] hover:bg-[#21262d] border border-[#30363d] rounded-lg cursor-pointer flex flex-col items-center justify-between text-center transition-colors group relative"
                >
                  <div className="w-8 h-8 flex items-center justify-center mb-1.5">
                    {getFileIcon(item)}
                  </div>
                  <span
                    className={`text-xs font-mono truncate w-full ${
                      isDir ? 'text-slate-100 font-semibold group-hover:text-emerald-400' : 'text-slate-200'
                    }`}
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  <span className="text-[10px] text-slate-500 tabular-nums mt-1">
                    {isDir ? 'Folder' : `${(item.size / 1024).toFixed(1)} KB`}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
};

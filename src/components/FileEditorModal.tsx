import React, { useState, useEffect } from 'react';
import {
  FileEdit,
  X,
  Save,
  Loader2,
  GitCommit,
  Check,
  AlertTriangle,
  FolderPlus,
} from 'lucide-react';
import { RepoContentItem } from '../types/github';
import { githubApi, utf8ToBase64 } from '../services/githubApi';

interface FileEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  owner: string;
  repo: string;
  branch: string;
  fileItem: RepoContentItem | null; // null if creating a new file
  initialContent?: string;
  targetFolder?: string; // for creating new file in specific directory
  onFileSaved: (filePath: string) => void;
}

export const FileEditorModal: React.FC<FileEditorModalProps> = ({
  isOpen,
  onClose,
  token,
  owner,
  repo,
  branch,
  fileItem,
  initialContent = '',
  targetFolder = '',
  onFileSaved,
}) => {
  const [filePath, setFilePath] = useState('');
  const [content, setContent] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [targetBranch, setTargetBranch] = useState(branch);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (fileItem) {
        setFilePath(fileItem.path);
        setContent(initialContent);
        setCommitMessage(`Update ${fileItem.name}`);
      } else {
        const prefix = targetFolder ? `${targetFolder.replace(/^\/+|\/+$/g, '')}/` : '';
        setFilePath(`${prefix}new-file.txt`);
        setContent('');
        setCommitMessage('Create new file via GitBuddy');
      }
      setTargetBranch(branch);
      setError(null);
    }
  }, [isOpen, fileItem, initialContent, targetFolder, branch]);

  if (!isOpen) return null;

  const lineCount = content.split('\n').length;
  const charCount = content.length;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!filePath.trim()) return;

    setIsSaving(true);
    setError(null);

    try {
      const base64 = utf8ToBase64(content);
      const sha = fileItem?.sha;
      const cleanPath = filePath.replace(/^\/+/, '');
      const msg = commitMessage.trim() || (fileItem ? `Update ${fileItem.name}` : `Create ${cleanPath}`);

      await githubApi.createOrUpdateFile(
        token,
        owner,
        repo,
        cleanPath,
        base64,
        msg,
        sha,
        targetBranch
      );

      onFileSaved(cleanPath);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setError(`Failed to save: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 lg:p-6 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-5xl w-full h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-4">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              {fileItem ? <FileEdit className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">Editing Path:</span>
                <input
                  type="text"
                  value={filePath}
                  onChange={(e) => setFilePath(e.target.value)}
                  placeholder="e.g. src/utils/helpers.ts"
                  className="bg-[#0d1117] border border-[#30363d] rounded px-2.5 py-1 text-xs font-mono text-emerald-400 flex-1 max-w-md focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 mx-4 mt-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Editor Area with synced line numbers */}
        <div className="flex-1 flex overflow-hidden bg-[#0d1117]">
          {/* Line numbers column */}
          <div className="w-12 py-3 pr-3 select-none text-right font-mono text-xs text-slate-600 border-r border-[#30363d] bg-[#0d1117] overflow-hidden">
            {Array.from({ length: Math.max(1, lineCount) }).map((_, i) => (
              <div key={i} className="leading-6 tabular-nums">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Code text input */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="flex-1 p-3 bg-transparent text-slate-200 font-mono text-xs leading-6 resize-none focus:outline-none overflow-auto whitespace-pre selection:bg-emerald-900/60"
            placeholder="Write your code or file contents here..."
          />
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-4 py-1.5 bg-[#161b22] border-t border-[#30363d] text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-4">
            <span>Lines: <strong className="text-slate-300">{lineCount}</strong></span>
            <span>Chars: <strong className="text-slate-300">{charCount}</strong></span>
            <span>Target Branch: <strong className="text-emerald-400">{targetBranch}</strong></span>
          </div>
          <div>UTF-8 Plain Text</div>
        </div>

        {/* Commit Options Drawer */}
        <form onSubmit={handleSave} className="p-4 bg-[#161b22] border-t border-[#30363d] space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Commit Message <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Brief summary of changes"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Branch
              </label>
              <input
                type="text"
                value={targetBranch}
                onChange={(e) => setTargetBranch(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-slate-400">
              Commits directly to <code className="text-emerald-400">{owner}/{repo}@{targetBranch}</code>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !filePath.trim() || !commitMessage.trim()}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md transition-colors flex items-center gap-1.5"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Committing Changes...
                  </>
                ) : (
                  <>
                    <GitCommit className="w-3.5 h-3.5" />
                    Commit and Push
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

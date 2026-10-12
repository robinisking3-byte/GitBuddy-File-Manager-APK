import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  X,
  FolderUp,
  FileUp,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  GitCommit,
  FileCode,
} from 'lucide-react';
import { processDataTransferItems, DroppedFileItem } from '../utils/dragDropHandler';
import { githubApi } from '../services/githubApi';

interface BatchUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  owner: string;
  repo: string;
  branch: string;
  currentPath: string;
  onUploaded: () => void;
}

export const BatchUploadModal: React.FC<BatchUploadModalProps> = ({
  isOpen,
  onClose,
  token,
  owner,
  repo,
  branch,
  currentPath,
  onUploaded,
}) => {
  const [queuedFiles, setQueuedFiles] = useState<DroppedFileItem[]>([]);
  const [isProcessingDrop, setIsProcessingDrop] = useState(false);
  const [targetPrefix, setTargetPrefix] = useState(currentPath || '');
  const [commitMessage, setCommitMessage] = useState('Batch upload files via GitBuddy');
  const [isCommitting, setIsCommitting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successCommitSha, setSuccessCommitSha] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDataTransfer = async (items: DataTransferItemList | FileList) => {
    setIsProcessingDrop(true);
    setError(null);
    try {
      const processed = await processDataTransferItems(items);
      setQueuedFiles((prev) => [...prev, ...processed]);
      setCommitMessage(`Batch upload ${processed.length} files via GitBuddy`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to read files: ${msg}`);
    } finally {
      setIsProcessingDrop(false);
    }
  };

  const removeFile = (index: number) => {
    setQueuedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearQueue = () => {
    setQueuedFiles([]);
    setSuccessCommitSha(null);
  };

  const handleCommit = async () => {
    if (queuedFiles.length === 0) return;

    setIsCommitting(true);
    setError(null);
    setProgressPercent(5);
    setProgressText('Preparing commit batch...');

    try {
      const cleanPrefix = targetPrefix.replace(/^\/+|\/+$/g, '');
      const filesPayload = queuedFiles.map((f) => {
        const destPath = cleanPrefix ? `${cleanPrefix}/${f.relativePath}` : f.relativePath;
        return {
          path: destPath,
          base64Content: f.base64Content,
        };
      });

      const res = await githubApi.batchCommitViaTree(
        token,
        owner,
        repo,
        branch,
        filesPayload,
        commitMessage,
        (msg, pct) => {
          setProgressText(msg);
          setProgressPercent(pct);
        }
      );

      setSuccessCommitSha(res.commitSha);
      onUploaded();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Batch commit failed: ${msg}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const totalSize = queuedFiles.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 lg:p-6 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Batch Upload Folders & Files</h3>
              <p className="text-xs text-slate-400">
                Drag and drop folders or files preserving tree paths to <span className="font-mono text-emerald-400">{owner}/{repo}@{branch}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {successCommitSha ? (
            <div className="p-6 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
              <h4 className="text-base font-semibold text-white">Batch Upload Committed Successfully!</h4>
              <p className="text-xs text-slate-300">
                {queuedFiles.length} files committed to branch <span className="font-mono text-emerald-400">{branch}</span>.
              </p>
              <div className="text-xs font-mono text-slate-400">
                Commit SHA: <span className="text-slate-200">{successCommitSha.substring(0, 10)}</span>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={clearQueue}
                  className="px-3 py-1.5 text-xs text-slate-300 bg-[#21262d] hover:bg-[#30363d] rounded-md transition-colors"
                >
                  Upload More Files
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors"
                >
                  View Files in Manager
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Drop area */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.items) {
                    handleDataTransfer(e.dataTransfer.items);
                  } else if (e.dataTransfer.files) {
                    handleDataTransfer(e.dataTransfer.files);
                  }
                }}
                className="border-2 border-dashed border-[#30363d] hover:border-emerald-500/60 rounded-xl p-8 text-center transition-colors bg-[#0d1117]/60 group"
              >
                <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-3 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">
                  Drag and drop files or entire folders here
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                  Folder hierarchies are automatically preserved and mapped into the target directory.
                </p>

                <div className="flex items-center justify-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) handleDataTransfer(e.target.files);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors flex items-center gap-1.5"
                  >
                    <FileUp className="w-3.5 h-3.5 text-emerald-400" />
                    Browse Individual Files
                  </button>

                  <input
                    ref={folderInputRef}
                    type="file"
                    /* @ts-ignore */
                    webkitdirectory=""
                    directory=""
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files) handleDataTransfer(e.target.files);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors flex items-center gap-1.5"
                  >
                    <FolderUp className="w-3.5 h-3.5 text-emerald-400" />
                    Browse Whole Folder
                  </button>
                </div>
              </div>

              {/* Target folder setting */}
              <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Target Destination Directory
                </label>
                <input
                  type="text"
                  value={targetPrefix}
                  onChange={(e) => setTargetPrefix(e.target.value)}
                  placeholder="Root directory / (or e.g. assets, src/components)"
                  className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 text-xs font-mono text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* Queued files table */}
              {queuedFiles.length > 0 && (
                <div className="border border-[#30363d] rounded-xl overflow-hidden bg-[#0d1117]">
                  <div className="p-3 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">
                      Files Queue ({queuedFiles.length} items · {(totalSize / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      onClick={clearQueue}
                      className="text-[11px] text-slate-400 hover:text-rose-400 transition-colors"
                    >
                      Clear Queue
                    </button>
                  </div>

                  <div className="max-h-52 overflow-y-auto divide-y divide-[#21262d] text-xs font-mono">
                    {queuedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between px-3 py-1.5 hover:bg-[#161b22]">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate text-slate-200">
                            {targetPrefix ? `${targetPrefix.replace(/^\/+|\/+$/g, '')}/` : ''}{file.relativePath}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            {(file.size / 1024).toFixed(1)} KB
                          </span>
                          <button
                            onClick={() => removeFile(idx)}
                            className="text-slate-500 hover:text-rose-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Commit message */}
              {queuedFiles.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Commit Message
                  </label>
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* Progress bar */}
              {isCommitting && (
                <div className="p-4 bg-[#0d1117] border border-[#30363d] rounded-xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">{progressText}</span>
                    <span className="text-emerald-400 font-mono font-semibold">{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-[#21262d] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!successCommitSha && (
          <div className="flex items-center justify-between p-4 border-t border-[#30363d] bg-[#161b22]">
            <div className="text-xs text-slate-400">
              Branch: <span className="font-mono text-emerald-400">{branch}</span>
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
                type="button"
                onClick={handleCommit}
                disabled={queuedFiles.length === 0 || isCommitting || isProcessingDrop}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md transition-colors flex items-center gap-1.5"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Committing Files...
                  </>
                ) : (
                  <>
                    <GitCommit className="w-3.5 h-3.5" />
                    Commit {queuedFiles.length} Files
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

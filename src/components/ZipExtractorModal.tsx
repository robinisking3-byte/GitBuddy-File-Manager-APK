import React, { useState, useRef } from 'react';
import {
  FileArchive,
  X,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileCode,
  FolderTree,
  GitCommit,
  Check,
  Folder,
} from 'lucide-react';
import { parseZipArchive, ExtractedFile } from '../utils/zipHandler';
import { githubApi } from '../services/githubApi';

interface ZipExtractorModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  owner: string;
  repo: string;
  branch: string;
  currentPath: string;
  onExtractedAndPushed: () => void;
}

export const ZipExtractorModal: React.FC<ZipExtractorModalProps> = ({
  isOpen,
  onClose,
  token,
  owner,
  repo,
  branch,
  currentPath,
  onExtractedAndPushed,
}) => {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [extractedFiles, setExtractedFiles] = useState<ExtractedFile[]>([]);
  const [detectedTopLevel, setDetectedTopLevel] = useState<string | null>(null);
  const [stripTopLevel, setStripTopLevel] = useState(true);
  const [targetPrefix, setTargetPrefix] = useState(currentPath || '');
  const [commitMessage, setCommitMessage] = useState('Extract and upload ZIP via GitBuddy');
  const [isCommitting, setIsCommitting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successCommitSha, setSuccessCommitSha] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Please select a valid .zip archive file.');
      return;
    }

    setZipFile(file);
    setIsParsing(true);
    setError(null);
    setSuccessCommitSha(null);

    try {
      const parsed = await parseZipArchive(file, {
        stripTopLevelFolder: stripTopLevel,
        targetPrefix,
      });

      setExtractedFiles(parsed.files);
      setDetectedTopLevel(parsed.detectedTopLevelFolder);
      setCommitMessage(`Extract ${file.name} preserving directory structure`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to extract ZIP archive: ${msg}`);
    } finally {
      setIsParsing(false);
    }
  };

  const recomputePaths = async (newStrip: boolean, newPrefix: string) => {
    if (!zipFile) return;
    setIsParsing(true);
    try {
      const parsed = await parseZipArchive(zipFile, {
        stripTopLevelFolder: newStrip,
        targetPrefix: newPrefix,
      });
      setExtractedFiles(parsed.files);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsParsing(false);
    }
  };

  const toggleSelectAll = (select: boolean) => {
    setExtractedFiles((prev) => prev.map((f) => ({ ...f, selected: select })));
  };

  const toggleSelectFile = (index: number) => {
    setExtractedFiles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], selected: !next[index].selected };
      return next;
    });
  };

  const handleCommit = async () => {
    const selectedFiles = extractedFiles.filter((f) => f.selected);
    if (selectedFiles.length === 0) {
      setError('Please select at least one file to commit.');
      return;
    }

    setIsCommitting(true);
    setError(null);
    setProgressPercent(5);
    setProgressText('Preparing commit payload...');

    try {
      const payloadFiles = selectedFiles.map((f) => ({
        path: f.relativePath,
        base64Content: f.base64Content,
      }));

      const res = await githubApi.batchCommitViaTree(
        token,
        owner,
        repo,
        branch,
        payloadFiles,
        commitMessage,
        (msg, pct) => {
          setProgressText(msg);
          setProgressPercent(pct);
        }
      );

      setSuccessCommitSha(res.commitSha);
      onExtractedAndPushed();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Commit failed: ${msg}`);
    } finally {
      setIsCommitting(false);
    }
  };

  const totalSize = extractedFiles.reduce((acc, f) => acc + f.size, 0);
  const selectedCount = extractedFiles.filter((f) => f.selected).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 lg:p-6 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FileArchive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Upload ZIP & Extract into Repository</h3>
              <p className="text-xs text-slate-400">
                Extracts files and mirrors exact folder structure inside <span className="font-mono text-emerald-400">{owner}/{repo}@{branch}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content area */}
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
              <h4 className="text-base font-semibold text-white">ZIP Extracted & Committed Successfully!</h4>
              <p className="text-xs text-slate-300">
                {selectedCount} files have been committed to <span className="font-mono text-emerald-400">{branch}</span> maintaining their exact directory hierarchy.
              </p>
              <div className="text-xs font-mono text-slate-400">
                Commit SHA: <span className="text-slate-200">{successCommitSha.substring(0, 10)}</span>
              </div>
              <div className="pt-2 flex justify-center gap-3">
                <button
                  onClick={() => {
                    setZipFile(null);
                    setExtractedFiles([]);
                    setSuccessCommitSha(null);
                  }}
                  className="px-3 py-1.5 text-xs text-slate-300 bg-[#21262d] hover:bg-[#30363d] rounded-md transition-colors"
                >
                  Upload Another ZIP
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
              {/* Dropzone */}
              {!zipFile ? (
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleFileChange(e.dataTransfer.files[0]);
                    }
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-[#30363d] hover:border-emerald-500/60 rounded-xl p-8 text-center cursor-pointer transition-colors bg-[#0d1117]/60 group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip,application/zip"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        handleFileChange(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-3 group-hover:scale-105 transition-transform">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-white mb-1">
                    Drop your .zip file here, or click to browse
                  </h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    GitBuddy will extract the entire folder structure client-side and publish it in an atomic Git commit preserving all paths.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* File summary & settings */}
                  <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <FileArchive className="w-5 h-5 text-emerald-400" />
                        <div>
                          <div className="text-xs font-semibold text-white">{zipFile.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {(zipFile.size / 1024 / 1024).toFixed(2)} MB archive · {extractedFiles.length} files detected ({(totalSize / 1024 / 1024).toFixed(2)} MB uncompressed)
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setZipFile(null);
                          setExtractedFiles([]);
                        }}
                        className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
                      >
                        Change File
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-[#21262d]">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Destination Subfolder in Repo
                        </label>
                        <div className="flex items-center gap-1.5">
                          <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <input
                            type="text"
                            value={targetPrefix}
                            onChange={(e) => {
                              const val = e.target.value;
                              setTargetPrefix(val);
                              recomputePaths(stripTopLevel, val);
                            }}
                            placeholder="e.g. src or lib (leave blank for repo root)"
                            className="flex-1 bg-[#161b22] border border-[#30363d] rounded px-2.5 py-1 text-xs font-mono text-emerald-400 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1">
                          Files will be placed under <code className="text-slate-400">/{targetPrefix || ''}</code>
                        </p>
                      </div>

                      {detectedTopLevel && (
                        <div className="flex flex-col justify-center">
                          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={stripTopLevel}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setStripTopLevel(checked);
                                recomputePaths(checked, targetPrefix);
                              }}
                              className="rounded border-[#30363d] text-emerald-600 focus:ring-emerald-500"
                            />
                            <span>
                              Strip archive root folder: <code className="text-emerald-400">{detectedTopLevel}/</code>
                            </span>
                          </label>
                          <p className="text-[10px] text-slate-500 mt-1 pl-5">
                            Prevents redundant nesting like <code className="text-slate-400">repo-main/repo-main/...</code>
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Extracted file list preview */}
                  <div className="border border-[#30363d] rounded-xl overflow-hidden bg-[#0d1117]">
                    <div className="p-3 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <FolderTree className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold text-slate-200">
                          Extracted Structure ({selectedCount} of {extractedFiles.length} selected)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleSelectAll(true)}
                          className="text-[11px] text-slate-400 hover:text-white"
                        >
                          Select All
                        </button>
                        <span className="text-slate-600">·</span>
                        <button
                          onClick={() => toggleSelectAll(false)}
                          className="text-[11px] text-slate-400 hover:text-white"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto divide-y divide-[#21262d] text-xs font-mono">
                      {isParsing ? (
                        <div className="p-6 text-center text-slate-400 flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                          <span>Parsing ZIP entries...</span>
                        </div>
                      ) : (
                        extractedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            onClick={() => toggleSelectFile(idx)}
                            className={`flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors ${
                              file.selected ? 'hover:bg-[#161b22]' : 'opacity-50 hover:opacity-75'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <input
                                type="checkbox"
                                checked={file.selected}
                                onChange={() => toggleSelectFile(idx)}
                                onClick={(e) => e.stopPropagation()}
                                className="rounded border-[#30363d] text-emerald-600"
                              />
                              <FileCode className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate text-slate-200">{file.relativePath}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 tabular-nums shrink-0">
                              {(file.size / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Commit message input */}
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

                  {/* Progress bar during commit */}
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
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer controls */}
        {!successCommitSha && (
          <div className="flex items-center justify-between p-4 border-t border-[#30363d] bg-[#161b22]">
            <div className="text-xs text-slate-400">
              Target Branch: <span className="font-mono text-emerald-400">{branch}</span>
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
                disabled={!zipFile || selectedCount === 0 || isCommitting || isParsing}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md transition-colors flex items-center gap-1.5"
              >
                {isCommitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Committing to Repo...
                  </>
                ) : (
                  <>
                    <GitCommit className="w-3.5 h-3.5" />
                    Commit Extracted Files ({selectedCount})
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

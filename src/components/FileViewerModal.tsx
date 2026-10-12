import React, { useState } from 'react';
import {
  FileText,
  X,
  Edit3,
  Copy,
  Check,
  Download,
  Trash2,
  FileCode,
  Image as ImageIcon,
  ExternalLink,
} from 'lucide-react';
import { RepoContentItem } from '../types/github';
import { base64ToUtf8 } from '../services/githubApi';

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileItem: RepoContentItem | null;
  onOpenEditor: (file: RepoContentItem, rawContent: string) => void;
  onDeleteFile: (file: RepoContentItem) => void;
}

export const FileViewerModal: React.FC<FileViewerModalProps> = ({
  isOpen,
  onClose,
  fileItem,
  onOpenEditor,
  onDeleteFile,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'raw' | 'preview'>('preview');

  if (!isOpen || !fileItem) return null;

  const isImage = /\.(png|jpe?g|gif|svg|webp|ico)$/i.test(fileItem.name);
  const isMarkdown = /\.md$/i.test(fileItem.name);
  const isJson = /\.json$/i.test(fileItem.name);

  let decodedContent = '';
  if (fileItem.content) {
    decodedContent = base64ToUtf8(fileItem.content);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(decodedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (fileItem.download_url) {
      window.open(fileItem.download_url, '_blank');
      return;
    }
    const blob = new Blob([decodedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileItem.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lines = decodedContent.split('\n');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 lg:p-6 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#30363d] bg-[#161b22]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              {isImage ? <ImageIcon className="w-4 h-4" /> : <FileCode className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-white truncate font-mono">{fileItem.name}</h3>
              <p className="text-[11px] text-slate-400 font-mono truncate">
                {fileItem.path} · {(fileItem.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isMarkdown && (
              <div className="flex items-center bg-[#21262d] p-0.5 rounded-md border border-[#30363d] text-xs">
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    viewMode === 'preview' ? 'bg-[#30363d] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Formatted
                </button>
                <button
                  onClick={() => setViewMode('raw')}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    viewMode === 'raw' ? 'bg-[#30363d] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Raw
                </button>
              </div>
            )}

            {!isImage && (
              <button
                onClick={() => {
                  onClose();
                  onOpenEditor(fileItem, decodedContent);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-1.5"
                title="Edit this file directly"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit File
              </button>
            )}

            {!isImage && (
              <button
                onClick={handleCopy}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-[#21262d] rounded-md transition-colors"
                title="Copy contents"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={handleDownload}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-[#21262d] rounded-md transition-colors"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                onClose();
                onDeleteFile(fileItem);
              }}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-md transition-colors"
              title="Delete file"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewport */}
        <div className="flex-1 overflow-auto bg-[#0d1117] p-4 font-mono text-xs text-slate-200">
          {isImage ? (
            <div className="h-full flex flex-col items-center justify-center p-6 text-center">
              {fileItem.download_url ? (
                <img
                  src={fileItem.download_url}
                  alt={fileItem.name}
                  className="max-h-[60vh] max-w-full rounded border border-[#30363d] object-contain shadow-lg"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="text-slate-400">Loading image preview...</div>
              )}
              <div className="mt-4 text-xs text-slate-400">
                {fileItem.name} ({(fileItem.size / 1024).toFixed(1)} KB)
              </div>
            </div>
          ) : isMarkdown && viewMode === 'preview' ? (
            <div className="max-w-3xl mx-auto py-4 px-2 font-sans text-slate-200 leading-relaxed space-y-4">
              <div className="p-4 bg-[#161b22] border border-[#30363d] rounded-lg">
                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-200">
                  {decodedContent}
                </pre>
              </div>
            </div>
          ) : (
            <div className="table w-full border-collapse">
              {lines.map((line, idx) => (
                <div key={idx} className="table-row hover:bg-[#161b22]">
                  <span className="table-cell select-none pr-4 pl-2 py-0.5 text-right text-slate-600 border-r border-[#30363d] w-12 font-mono tabular-nums">
                    {idx + 1}
                  </span>
                  <span className="table-cell pl-4 py-0.5 whitespace-pre font-mono text-slate-200">
                    {line || ' '}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

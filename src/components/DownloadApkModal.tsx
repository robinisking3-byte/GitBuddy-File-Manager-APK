import React, { useState } from 'react';
import {
  Smartphone,
  Download,
  X,
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  Package,
  Layers,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface DownloadApkModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeRepoName?: string;
  onNavigateToWorkflows?: () => void;
}

export const DownloadApkModal: React.FC<DownloadApkModalProps> = ({
  isOpen,
  onClose,
  activeRepoName,
  onNavigateToWorkflows,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen) return null;

  const directDownloadUrl = `${window.location.origin}/downloads/gitbuddy-release.apk`;
  const relativeDownloadUrl = '/downloads/gitbuddy-release.apk';

  const handleCopy = () => {
    navigator.clipboard.writeText(directDownloadUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  const handleDirectDownload = () => {
    setIsDownloading(true);
    const link = document.createElement('a');
    link.href = relativeDownloadUrl;
    link.download = 'gitbuddy-release.apk';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setIsDownloading(false), 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-[#30363d] bg-[#0d1117] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-sm p-1">
              <img src="/logo.svg" alt="GitBuddy Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Download GitBuddy Production APK
                <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full">
                  Ready
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Production-compiled Android application package (v1.0.0)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-[#21262d] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {/* Main Download Card */}
          <div className="bg-gradient-to-br from-emerald-950/40 via-[#0d1117] to-cyan-950/20 border border-emerald-500/30 rounded-xl p-5 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-white font-mono">
                    gitbuddy-release.apk
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                  <span className="flex items-center gap-1 text-slate-200 font-semibold">
                    <Package className="w-3.5 h-3.5 text-emerald-400" /> 54.0 MB (Compiled Binary)
                  </span>
                  <span>•</span>
                  <span>Package: <code className="text-emerald-300 font-mono text-[11px]">com.gitbuddy.app</code></span>
                  <span>•</span>
                  <span>Android 7.0+ (ARM64, ARMv7, x86_64)</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <button
                  onClick={handleDirectDownload}
                  disabled={isDownloading}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 shrink-0 active:scale-95"
                >
                  <Download className={`w-4 h-4 ${isDownloading ? 'animate-bounce' : ''}`} />
                  {isDownloading ? 'Starting Download...' : 'Download APK (54 MB)'}
                </button>
                <a
                  href="https://github.com/robinisking3-byte/CineCut-Pro-Video-Editor-APK/releases/download/v1.0.0/CineCut-Pro-Release.apk"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 bg-[#21262d] hover:bg-[#30363d] text-slate-200 border border-[#30363d] rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  title="Direct GitHub CDN Release Mirror"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  <span>GitHub CDN Mirror</span>
                </a>
              </div>
            </div>

            {/* Direct Link Share box */}
            <div className="mt-4 pt-3 border-t border-emerald-500/20">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1.5">
                Shareable Direct Download Link:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={directDownloadUrl}
                  className="w-full px-3 py-1.5 text-xs font-mono bg-[#0d1117] text-emerald-300 border border-[#30363d] rounded-lg focus:outline-none select-all"
                />
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-slate-200 border border-[#30363d] rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Key Production Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">Signed Production Manifest</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Pre-configured with Internet & Web Push Notification permissions.
                </p>
              </div>
            </div>

            <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-200">CI/CD Automated Builds</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  GitHub Actions workflow file in repository to build releases on push.
                </p>
              </div>
            </div>
          </div>

          {/* GitHub Actions Build Option */}
          {activeRepoName && onNavigateToWorkflows && (
            <div className="bg-[#0d1117] border border-[#30363d] rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-slate-300 font-medium">Rebuild from source via GitHub Actions?</span>
                  <p className="text-[11px] text-slate-500">
                    Repo: <span className="text-slate-300 font-mono">{activeRepoName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  onClose();
                  onNavigateToWorkflows();
                }}
                className="px-3 py-1.5 bg-[#21262d] hover:bg-[#30363d] text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 transition-colors"
              >
                Trigger CI/CD Build
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#30363d] bg-[#0d1117] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#21262d] hover:bg-[#30363d] text-slate-300 rounded-lg text-xs font-medium transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleDirectDownload}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download APK
          </button>
        </div>
      </div>
    </div>
  );
};

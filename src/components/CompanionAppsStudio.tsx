import React, { useState } from 'react';
import {
  Code2,
  Terminal,
  Smartphone,
  Download,
  Copy,
  Check,
  FolderArchive,
  ExternalLink,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  PYTHON_GITBUDDY_SCRIPT,
  FLUTTER_PUBSPEC,
  FLUTTER_MAIN_DART,
} from '../utils/companionSources';
import { createZipFromFiles } from '../utils/zipHandler';

export const CompanionAppsStudio: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'python' | 'flutter'>('python');
  const [copiedPython, setCopiedPython] = useState(false);
  const [copiedFlutter, setCopiedFlutter] = useState(false);
  const [isBundlingFlutter, setIsBundlingFlutter] = useState(false);

  const handleCopyPython = () => {
    navigator.clipboard.writeText(PYTHON_GITBUDDY_SCRIPT);
    setCopiedPython(true);
    setTimeout(() => setCopiedPython(false), 2000);
  };

  const handleDownloadPython = () => {
    const blob = new Blob([PYTHON_GITBUDDY_SCRIPT], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gitbuddy.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyFlutter = () => {
    navigator.clipboard.writeText(FLUTTER_MAIN_DART);
    setCopiedFlutter(true);
    setTimeout(() => setCopiedFlutter(false), 2000);
  };

  const handleDownloadFlutterZip = async () => {
    setIsBundlingFlutter(true);
    try {
      const files = [
        { path: 'pubspec.yaml', content: FLUTTER_PUBSPEC },
        { path: 'lib/main.dart', content: FLUTTER_MAIN_DART },
        {
          path: 'README.md',
          content: `# GitBuddy (Flutter Edition)

A high-performance GitHub File Manager and Actions Controller built in Flutter.

## Features
- GitHub PAT Authentication
- File Manager (Browse, Read, Edit, Delete repo contents)
- ZIP Upload & Structure Mirroring into Repos
- Real-time GitHub Actions & Workflows Monitoring

## Quick Start
\`\`\`bash
flutter pub get
flutter run
\`\`\`
`,
        },
      ];

      const zipBlob = await createZipFromFiles(files);
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'gitbuddy-flutter-app.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download failed: ${err}`);
    } finally {
      setIsBundlingFlutter(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Overview Banner */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1 rounded bg-emerald-500/10 text-emerald-400">
                <Code2 className="w-5 h-5" />
              </span>
              <h2 className="text-base font-semibold text-white">
                GitBuddy Native Python & Flutter Implementations
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              In addition to the interactive web application, GitBuddy provides standalone native source code for both Python (CLI/daemon) and Flutter (cross-platform Android/iOS/Desktop) pre-configured with your PAT token.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveSubTab('python')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'python'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-[#21262d] text-slate-300 hover:bg-[#30363d] border border-[#30363d]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Python App (gitbuddy.py)
            </button>
            <button
              onClick={() => setActiveSubTab('flutter')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 ${
                activeSubTab === 'flutter'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-[#21262d] text-slate-300 hover:bg-[#30363d] border border-[#30363d]'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Flutter App Bundle
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: Python Edition */}
      {activeSubTab === 'python' ? (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#30363d] bg-[#0d1117] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-xs font-semibold text-white">gitbuddy.py</span>
                <span className="text-[11px] text-slate-400 ml-2">Standalone CLI & Automation Engine</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyPython}
                className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-[#21262d] hover:bg-[#30363d] rounded border border-[#30363d] transition-colors flex items-center gap-1.5"
              >
                {copiedPython ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Code</span>
              </button>
              <button
                onClick={handleDownloadPython}
                className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download gitbuddy.py</span>
              </button>
            </div>
          </div>

          <div className="p-4 bg-[#161b22] border-b border-[#30363d] text-xs space-y-2">
            <div className="text-slate-300 font-semibold">How to run:</div>
            <div className="bg-[#0d1117] p-3 rounded-lg border border-[#30363d] font-mono text-[11px] text-slate-300 space-y-1">
              <div className="text-slate-500"># 1. Install dependencies</div>
              <div>pip install requests</div>
              <div className="text-slate-500 pt-1"># 2. Upload and extract ZIP maintaining tree structure</div>
              <div>python gitbuddy.py --repo robinisking3-byte/VidFlow --zip ./my-assets.zip --dest src/</div>
              <div className="text-slate-500 pt-1"># 3. Live monitor GitHub Actions workflows</div>
              <div>python gitbuddy.py --repo robinisking3-byte/VidFlow --monitor-actions</div>
            </div>
          </div>

          <div className="p-4 bg-[#0d1117] overflow-auto max-h-[500px] font-mono text-xs text-slate-300 leading-relaxed">
            <pre className="whitespace-pre">{PYTHON_GITBUDDY_SCRIPT}</pre>
          </div>
        </div>
      ) : (
        /* Tab 2: Flutter Edition */
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#30363d] bg-[#0d1117] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-xs font-semibold text-white">GitBuddy Flutter Project</span>
                <span className="text-[11px] text-slate-400 ml-2">Android, iOS, macOS, Windows & Web</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyFlutter}
                className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-[#21262d] hover:bg-[#30363d] rounded border border-[#30363d] transition-colors flex items-center gap-1.5"
              >
                {copiedFlutter ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy main.dart</span>
              </button>
              <button
                onClick={handleDownloadFlutterZip}
                disabled={isBundlingFlutter}
                className="px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Flutter Project (.zip)</span>
              </button>
            </div>
          </div>

          <div className="p-4 bg-[#161b22] border-b border-[#30363d] text-xs space-y-2">
            <div className="text-slate-300 font-semibold">Flutter Execution Setup:</div>
            <div className="bg-[#0d1117] p-3 rounded-lg border border-[#30363d] font-mono text-[11px] text-slate-300 space-y-1">
              <div className="text-slate-500"># 1. Extract the downloaded zip and get packages</div>
              <div>flutter pub get</div>
              <div className="text-slate-500 pt-1"># 2. Run on connected mobile or desktop target</div>
              <div>flutter run -d chrome  # or -d android / macos / windows</div>
            </div>
          </div>

          <div className="p-4 bg-[#0d1117] overflow-auto max-h-[500px] font-mono text-xs text-slate-300 leading-relaxed">
            <pre className="whitespace-pre">{FLUTTER_MAIN_DART}</pre>
          </div>
        </div>
      )}
    </div>
  );
};

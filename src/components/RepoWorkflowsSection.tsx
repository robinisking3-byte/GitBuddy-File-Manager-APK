import React, { useState, useEffect } from 'react';
import {
  PlaySquare,
  Package,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  Play,
  Terminal,
  Loader2,
  FileCode,
  Bell,
  BellOff,
  ExternalLink,
  Save,
  Check,
  AlertTriangle,
  FolderDown,
} from 'lucide-react';
import { Workflow, WorkflowRun, WorkflowArtifact, GitHubRepo } from '../types/github';
import { githubApi, uint8ArrayToBase64 } from '../services/githubApi';
import { notificationService } from '../services/notificationService';

interface RepoWorkflowsSectionProps {
  repo: GitHubRepo;
  token: string;
  branch: string;
  onOpenLiveLogs: (run: WorkflowRun) => void;
  onRefreshRepoFiles: () => void;
}

export const RepoWorkflowsSection: React.FC<RepoWorkflowsSectionProps> = ({
  repo,
  token,
  branch,
  onOpenLiveLogs,
  onRefreshRepoFiles,
}) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [artifacts, setArtifacts] = useState<WorkflowArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [savingToRepoId, setSavingToRepoId] = useState<number | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Push Notifications state
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    notificationService.getPermission() === 'granted'
  );

  const owner = repo.owner?.login || repo.full_name.split('/')[0];
  const repoName = repo.name;

  const loadData = async () => {
    try {
      const [wfs, runList, artifactList] = await Promise.all([
        githubApi.getWorkflows(token, owner, repoName),
        githubApi.getWorkflowRuns(token, owner, repoName),
        githubApi.getRepoArtifacts(token, owner, repoName),
      ]);
      setWorkflows(wfs);
      setRuns(runList);
      setArtifacts(artifactList);
    } catch (err) {
      console.warn('Failed to load repo workflows data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadData();
  }, [owner, repoName, token]);

  // Real-time tracking & push notifications for workflow status transitions
  useEffect(() => {
    const prevStatusMap = new Map<number, { status: string; conclusion: string | null }>();
    runs.forEach((r) => prevStatusMap.set(r.id, { status: r.status, conclusion: r.conclusion }));

    const interval = setInterval(async () => {
      try {
        const freshRuns = await githubApi.getWorkflowRuns(token, owner, repoName);
        const freshArtifacts = await githubApi.getRepoArtifacts(token, owner, repoName);
        setArtifacts(freshArtifacts);

        // Check for state transitions to trigger notifications
        freshRuns.forEach((freshRun) => {
          const prev = prevStatusMap.get(freshRun.id);
          if (prev) {
            // Did it transition from in_progress/queued to completed?
            if (
              (prev.status === 'in_progress' || prev.status === 'queued') &&
              freshRun.status === 'completed'
            ) {
              if (freshRun.conclusion === 'success') {
                notificationService.notifyWorkflowEvent({
                  type: 'success',
                  workflowName: freshRun.name || freshRun.display_title,
                  repoName: repo.full_name,
                  branch: freshRun.head_branch,
                  runNumber: freshRun.run_number,
                  conclusion: 'success',
                });
              } else if (freshRun.conclusion === 'failure') {
                notificationService.notifyWorkflowEvent({
                  type: 'failure',
                  workflowName: freshRun.name || freshRun.display_title,
                  repoName: repo.full_name,
                  branch: freshRun.head_branch,
                  runNumber: freshRun.run_number,
                  conclusion: freshRun.conclusion,
                });
              } else {
                notificationService.notifyWorkflowEvent({
                  type: 'complete',
                  workflowName: freshRun.name || freshRun.display_title,
                  repoName: repo.full_name,
                  branch: freshRun.head_branch,
                  runNumber: freshRun.run_number,
                  conclusion: freshRun.conclusion,
                });
              }
            }
          }
          prevStatusMap.set(freshRun.id, { status: freshRun.status, conclusion: freshRun.conclusion });
        });

        setRuns(freshRuns);
      } catch (err) {
        console.warn('Real-time workflow polling error:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [runs, owner, repoName, repo.full_name, token]);

  const handleToggleNotifications = async () => {
    if (notificationService.getPermission() === 'granted') {
      alert('Browser push notifications are already enabled for this application.');
      setNotificationsEnabled(true);
      return;
    }
    const perm = await notificationService.requestPermission();
    if (perm === 'granted') {
      setNotificationsEnabled(true);
      notificationService.notifyWorkflowEvent({
        type: 'complete',
        workflowName: 'GitBuddy Push Notifications',
        repoName: repo.full_name,
        branch,
        runNumber: 1,
        conclusion: 'Enabled',
      });
    } else {
      setNotificationsEnabled(false);
      alert('Notification permissions were not granted by the browser.');
    }
  };

  const handleDownloadArtifact = async (artifact: WorkflowArtifact) => {
    setDownloadingId(artifact.id);
    try {
      const blob = await githubApi.downloadArtifactBlob(token, owner, repoName, artifact.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${artifact.name}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      alert(`Artifact download failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleSaveArtifactIntoRepo = async (artifact: WorkflowArtifact) => {
    setSavingToRepoId(artifact.id);
    setSaveSuccessMsg(null);
    try {
      const blob = await githubApi.downloadArtifactBlob(token, owner, repoName, artifact.id);
      const buffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const base64 = uint8ArrayToBase64(bytes);

      const targetPath = `builds/${artifact.name}.zip`;
      await githubApi.createOrUpdateFile(
        token,
        owner,
        repoName,
        targetPath,
        base64,
        `Store build artifact ${artifact.name} from workflow via GitBuddy`,
        undefined,
        branch
      );

      setSaveSuccessMsg(`Saved to /${targetPath} in repo!`);
      onRefreshRepoFiles();
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: unknown) {
      alert(`Failed to store artifact into repo: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingToRepoId(null);
    }
  };

  const successfulRuns = runs.filter((r) => r.status === 'completed' && r.conclusion === 'success');

  return (
    <div className="space-y-6">
      {/* Workflows Section Header */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <PlaySquare className="w-4 h-4" />
              </div>
              <h2 className="text-base font-semibold text-white">
                Workflows & Build Artifacts ({repo.name})
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Automatic artifact storage for files provided after workflow success (e.g., APK releases, test packages, archives). Includes real-time desktop push notifications for Workflow Complete, Success, and Failure.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleToggleNotifications}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                notificationsEnabled
                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                  : 'bg-[#21262d] text-slate-300 hover:bg-[#30363d] border border-[#30363d]'
              }`}
              title="Toggle Desktop Push Notifications for Workflow Success, Failure and Completion"
            >
              {notificationsEnabled ? (
                <>
                  <Bell className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Push Alerts: ON</span>
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Enable Push Alerts</span>
                </>
              )}
            </button>

            <button
              onClick={() => {
                setIsRefreshing(true);
                loadData();
              }}
              disabled={isRefreshing}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-[#21262d] rounded-md transition-colors"
              title="Refresh workflows and artifacts"
            >
              <RotateCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Primary Section: Build Output Artifacts (APKs & Archives) */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 bg-[#0d1117] border-b border-[#30363d] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-white">
              Generated Build Files & Artifacts (Stored for Download)
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            {artifacts.length} build {artifacts.length === 1 ? 'file' : 'files'} available
          </span>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Scanning workflow run artifacts...</span>
          </div>
        ) : artifacts.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400 space-y-2">
            <Package className="w-8 h-8 text-slate-600 mx-auto" />
            <p>No build output artifacts generated yet in this repository.</p>
            <p className="text-[11px] text-slate-500 max-w-md mx-auto">
              When a workflow with artifact uploading (such as Flutter APK build, Python package, or release sync) succeeds, the output file will be stored here for direct download.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#21262d]">
            {artifacts.map((artifact) => {
              const isApk = artifact.name.toLowerCase().includes('apk');
              return (
                <div
                  key={artifact.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#21262d]/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${
                        isApk
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      }`}
                    >
                      <Package className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-100 font-mono truncate">
                          {artifact.name}
                        </span>
                        {isApk && (
                          <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.5 rounded font-mono font-semibold">
                            APK
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>{(artifact.size_in_bytes / 1024 / 1024).toFixed(2)} MB</span>
                        <span>·</span>
                        <span>Created {new Date(artifact.created_at).toLocaleDateString()}</span>
                        {artifact.workflow_run && (
                          <>
                            <span>·</span>
                            <span>Run #{artifact.workflow_run.id}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      onClick={() => handleDownloadArtifact(artifact)}
                      disabled={downloadingId === artifact.id}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      {downloadingId === artifact.id ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Downloading...</span>
                        </>
                      ) : (
                        <>
                          <Download className="w-3.5 h-3.5" />
                          <span>Download {isApk ? 'APK' : 'File'}</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleSaveArtifactIntoRepo(artifact)}
                      disabled={savingToRepoId === artifact.id}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors flex items-center gap-1.5"
                      title="Store and commit this artifact file directly into /builds in the repository"
                    >
                      {savingToRepoId === artifact.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      ) : (
                        <FolderDown className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>Save to /builds</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Workflow Runs History */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 bg-[#0d1117] border-b border-[#30363d] flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200">
            Workflow Execution History & Logs
          </span>
          <span className="text-[11px] text-slate-400">
            Real-time polling active
          </span>
        </div>

        {runs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            No executions recorded for {repo.name}.
          </div>
        ) : (
          <div className="divide-y divide-[#21262d] max-h-72 overflow-y-auto">
            {runs.slice(0, 15).map((run) => (
              <div
                key={run.id}
                onClick={() => onOpenLiveLogs(run)}
                className="p-3 flex items-center justify-between gap-3 hover:bg-[#21262d]/60 cursor-pointer transition-colors text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {run.status === 'in_progress' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
                  ) : run.conclusion === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}

                  <div className="min-w-0">
                    <span className="font-semibold text-slate-200 hover:text-emerald-400 truncate block">
                      #{run.run_number} {run.name || run.display_title}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {run.head_branch} · {new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[11px] font-mono px-2 py-0.5 rounded ${
                      run.conclusion === 'success'
                        ? 'text-emerald-400 bg-emerald-950/40'
                        : run.conclusion === 'failure'
                        ? 'text-rose-400 bg-rose-950/40'
                        : 'text-amber-400 bg-amber-950/40'
                    }`}
                  >
                    {run.conclusion || run.status}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenLiveLogs(run);
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#30363d]"
                    title="View live execution logs"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

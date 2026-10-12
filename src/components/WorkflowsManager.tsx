import React, { useState, useEffect, useRef } from 'react';
import {
  PlaySquare,
  Play,
  RotateCw,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Search,
  Download,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  X,
  FileCode,
  ExternalLink,
  Ban,
  Package,
  Bell,
  BellOff,
  FolderDown,
  Smartphone,
} from 'lucide-react';
import { Workflow, WorkflowRun, WorkflowJob, WorkflowArtifact } from '../types/github';
import { githubApi, utf8ToBase64, uint8ArrayToBase64 } from '../services/githubApi';
import { WORKFLOW_TEMPLATES, parseAnsiToHtml, WorkflowTemplate } from '../utils/workflowTemplates';
import { notificationService } from '../services/notificationService';

interface WorkflowsManagerProps {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  onRefreshRepoFiles?: () => void;
}

export const WorkflowsManager: React.FC<WorkflowsManagerProps> = ({
  token,
  owner,
  repo,
  branch,
  onRefreshRepoFiles,
}) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [artifacts, setArtifacts] = useState<WorkflowArtifact[]>([]);
  const [downloadingArtifactId, setDownloadingArtifactId] = useState<number | null>(null);
  const [savingArtifactId, setSavingArtifactId] = useState<number | null>(null);
  const [saveArtifactMsg, setSaveArtifactMsg] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(
    notificationService.getPermission() === 'granted'
  );
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [jobs, setJobs] = useState<WorkflowJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [logsText, setLogsText] = useState('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isCopied, setIsCopied] = useState(false);

  // New Workflow Creator Modal
  const [isNewWorkflowOpen, setIsNewWorkflowOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate>(WORKFLOW_TEMPLATES[0]);
  const [customWorkflowFilename, setCustomWorkflowFilename] = useState(WORKFLOW_TEMPLATES[0].filename);
  const [customWorkflowContent, setCustomWorkflowContent] = useState(WORKFLOW_TEMPLATES[0].content);
  const [isSubmittingWorkflow, setIsSubmittingWorkflow] = useState(false);
  const [newWorkflowError, setNewWorkflowError] = useState<string | null>(null);

  // Dispatch Run Modal
  const [dispatchWorkflowTarget, setDispatchWorkflowTarget] = useState<Workflow | null>(null);
  const [dispatchBranch, setDispatchBranch] = useState(branch);
  const [isDispatching, setIsDispatching] = useState(false);
  const [dispatchSuccessMsg, setDispatchSuccessMsg] = useState<string | null>(null);

  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Initial load
  useEffect(() => {
    fetchWorkflowsAndRuns();
  }, [owner, repo, token]);

  // Real-time polling for active workflow runs and triggering push notifications
  useEffect(() => {
    const prevStatusMap = new Map<number, { status: string; conclusion: string | null }>();
    runs.forEach((r) => prevStatusMap.set(r.id, { status: r.status, conclusion: r.conclusion }));

    const interval = setInterval(async () => {
      try {
        const [freshRuns, freshArtifacts] = await Promise.all([
          githubApi.getWorkflowRuns(token, owner, repo),
          githubApi.getRepoArtifacts(token, owner, repo),
        ]);
        setArtifacts(freshArtifacts);

        // Check for state transitions to trigger notifications
        freshRuns.forEach((freshRun) => {
          const prev = prevStatusMap.get(freshRun.id);
          if (prev) {
            if (
              (prev.status === 'in_progress' || prev.status === 'queued') &&
              freshRun.status === 'completed'
            ) {
              if (freshRun.conclusion === 'success') {
                notificationService.notifyWorkflowEvent({
                  type: 'success',
                  workflowName: freshRun.name || freshRun.display_title,
                  repoName: `${owner}/${repo}`,
                  branch: freshRun.head_branch,
                  runNumber: freshRun.run_number,
                  conclusion: 'success',
                });
              } else if (freshRun.conclusion === 'failure') {
                notificationService.notifyWorkflowEvent({
                  type: 'failure',
                  workflowName: freshRun.name || freshRun.display_title,
                  repoName: `${owner}/${repo}`,
                  branch: freshRun.head_branch,
                  runNumber: freshRun.run_number,
                  conclusion: freshRun.conclusion,
                });
              } else {
                notificationService.notifyWorkflowEvent({
                  type: 'complete',
                  workflowName: freshRun.name || freshRun.display_title,
                  repoName: `${owner}/${repo}`,
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

        if (selectedRun) {
          const freshSelected = freshRuns.find((r) => r.id === selectedRun.id);
          if (freshSelected) {
            setSelectedRun(freshSelected);
            if (freshSelected.status === 'in_progress' || freshSelected.status === 'queued') {
              const freshJobs = await githubApi.getWorkflowJobs(token, owner, repo, freshSelected.id);
              setJobs(freshJobs);
              if (selectedJobId) {
                const freshLogs = await githubApi.getJobLogs(token, owner, repo, selectedJobId);
                setLogsText(freshLogs);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Real-time polling tick error:', err);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, [runs, selectedRun, selectedJobId, owner, repo, token]);

  // Auto-scroll terminal logs to bottom when updated
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logsText, autoScroll]);

  const fetchWorkflowsAndRuns = async () => {
    setIsLoading(true);
    try {
      const [wfList, runList, artifactList] = await Promise.all([
        githubApi.getWorkflows(token, owner, repo),
        githubApi.getWorkflowRuns(token, owner, repo),
        githubApi.getRepoArtifacts(token, owner, repo),
      ]);
      setWorkflows(wfList);
      setRuns(runList);
      setArtifacts(artifactList);
    } catch (err) {
      console.warn('Failed to fetch workflows:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const openRunDetails = async (run: WorkflowRun) => {
    setSelectedRun(run);
    setIsLoadingLogs(true);
    setLogsText('');
    try {
      const runJobs = await githubApi.getWorkflowJobs(token, owner, repo, run.id);
      setJobs(runJobs);
      if (runJobs.length > 0) {
        const firstJob = runJobs[0];
        setSelectedJobId(firstJob.id);
        const logs = await githubApi.getJobLogs(token, owner, repo, firstJob.id);
        setLogsText(logs);
      } else {
        setLogsText('No active runner jobs allocated for this run yet.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLogsText(`Unable to load job logs: ${msg}`);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleSelectJob = async (jobId: number) => {
    setSelectedJobId(jobId);
    setIsLoadingLogs(true);
    try {
      const logs = await githubApi.getJobLogs(token, owner, repo, jobId);
      setLogsText(logs);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLogsText(`Failed to load job logs: ${msg}`);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchWorkflowTarget) return;

    setIsDispatching(true);
    setDispatchSuccessMsg(null);
    try {
      await githubApi.dispatchWorkflow(
        token,
        owner,
        repo,
        dispatchWorkflowTarget.id,
        dispatchBranch
      );
      setDispatchSuccessMsg(`Workflow "${dispatchWorkflowTarget.name}" dispatched on ${dispatchBranch}!`);
      setTimeout(() => {
        setDispatchWorkflowTarget(null);
        setDispatchSuccessMsg(null);
        fetchWorkflowsAndRuns();
      }, 1500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Workflow dispatch failed: ${msg}`);
    } finally {
      setIsDispatching(false);
    }
  };

  const handleRerun = async (runId: number) => {
    try {
      await githubApi.rerunWorkflow(token, owner, repo, runId);
      alert('Rerun requested! Check the runs list in a few seconds.');
      fetchWorkflowsAndRuns();
    } catch (err: unknown) {
      alert(`Rerun failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCancelRun = async (runId: number) => {
    try {
      await githubApi.cancelWorkflowRun(token, owner, repo, runId);
      alert('Cancellation requested for this run.');
      fetchWorkflowsAndRuns();
    } catch (err: unknown) {
      alert(`Cancel failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleCreateWorkflowFile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingWorkflow(true);
    setNewWorkflowError(null);

    try {
      const cleanFilename = customWorkflowFilename.trim().replace(/^\/+/, '');
      const path = `.github/workflows/${cleanFilename}`;
      const base64 = utf8ToBase64(customWorkflowContent);

      await githubApi.createOrUpdateFile(
        token,
        owner,
        repo,
        path,
        base64,
        `Add GitHub Action workflow: ${cleanFilename} via GitBuddy`,
        undefined,
        branch
      );

      setIsNewWorkflowOpen(false);
      fetchWorkflowsAndRuns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setNewWorkflowError(`Failed to commit workflow: ${msg}`);
    } finally {
      setIsSubmittingWorkflow(false);
    }
  };

  const handleCopyLogs = () => {
    navigator.clipboard.writeText(logsText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-run-${selectedRun?.id}-job-${selectedJobId}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (run: WorkflowRun) => {
    if (run.status === 'in_progress') {
      return (
        <span className="flex items-center gap-1.5 text-amber-400 font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> In Progress
        </span>
      );
    }
    if (run.status === 'queued') {
      return (
        <span className="flex items-center gap-1.5 text-slate-400 font-medium">
          <Clock className="w-3.5 h-3.5" /> Queued
        </span>
      );
    }
    if (run.conclusion === 'success') {
      return (
        <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" /> Success
        </span>
      );
    }
    if (run.conclusion === 'failure') {
      return (
        <span className="flex items-center gap-1.5 text-rose-400 font-medium">
          <XCircle className="w-3.5 h-3.5" /> Failed
        </span>
      );
    }
    if (run.conclusion === 'cancelled') {
      return (
        <span className="flex items-center gap-1.5 text-slate-500 font-medium">
          <Ban className="w-3.5 h-3.5" /> Cancelled
        </span>
      );
    }
    return <span className="text-slate-400">{run.status}</span>;
  };

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
        <div>
          <h2 className="text-base font-semibold text-white flex items-center gap-2">
            <PlaySquare className="w-5 h-5 text-emerald-400" />
            GitHub Actions & CI Workflows
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time pipeline monitoring, manual dispatches, and live execution logs for <span className="font-mono text-emerald-400">{owner}/{repo}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
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
                  workflowName: 'GitBuddy Push Alerts',
                  repoName: `${owner}/${repo}`,
                  branch,
                  runNumber: 1,
                  conclusion: 'Activated',
                });
              } else {
                setNotificationsEnabled(false);
                alert('Notifications were not granted by the browser.');
              }
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              notificationsEnabled
                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                : 'bg-[#21262d] text-slate-300 hover:bg-[#30363d] border border-[#30363d]'
            }`}
            title="Desktop push alerts for Workflow Complete, Success, and Failure"
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

          <a
            href="/downloads/gitbuddy-release.apk"
            download="gitbuddy-release.apk"
            className="px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-md transition-colors flex items-center gap-1.5 shadow-xs border border-emerald-400/30"
            title="Download compiled Android APK package"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Download APK</span>
          </a>

          <button
            onClick={() => setIsNewWorkflowOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            New Workflow
          </button>
          <button
            onClick={fetchWorkflowsAndRuns}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-[#21262d] rounded-md transition-colors"
            title="Refresh runs"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {saveArtifactMsg && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveArtifactMsg}</span>
        </div>
      )}

      {/* Section: Build Artifacts & Output Files (APKs, ZIPs) */}
      {artifacts.length > 0 && (
        <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-xs">
          <div className="p-3.5 bg-[#0d1117] border-b border-[#30363d] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-semibold text-white">
                Build Output Files & APK Artifacts ({artifacts.length})
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">
              Generated after successful workflows · Available to download or save into repo
            </span>
          </div>

          <div className="divide-y divide-[#21262d]">
            {artifacts.map((art) => {
              const isApk = art.name.toLowerCase().includes('apk');
              return (
                <div
                  key={art.id}
                  className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#21262d]/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                        isApk
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                      }`}
                    >
                      <Package className="w-4 h-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-slate-100 font-mono truncate">
                          {art.name}
                        </span>
                        {isApk && (
                          <span className="text-[10px] bg-emerald-950/60 text-emerald-400 border border-emerald-500/40 px-1.5 py-0.5 rounded font-mono font-semibold">
                            APK
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                        <span>{(art.size_in_bytes / 1024 / 1024).toFixed(2)} MB</span>
                        <span>·</span>
                        <span>Created {new Date(art.created_at).toLocaleDateString()}</span>
                        {art.workflow_run && (
                          <>
                            <span>·</span>
                            <span>Run #{art.workflow_run.id}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      onClick={async () => {
                        setDownloadingArtifactId(art.id);
                        try {
                          const blob = await githubApi.downloadArtifactBlob(token, owner, repo, art.id);
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `${art.name}.zip`;
                          a.click();
                          URL.revokeObjectURL(url);
                        } catch (err: unknown) {
                          alert(`Download failed: ${err instanceof Error ? err.message : String(err)}`);
                        } finally {
                          setDownloadingArtifactId(null);
                        }
                      }}
                      disabled={downloadingArtifactId === art.id}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-md transition-colors flex items-center gap-1.5 shadow-xs"
                    >
                      {downloadingArtifactId === art.id ? (
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
                      onClick={async () => {
                        setSavingArtifactId(art.id);
                        setSaveArtifactMsg(null);
                        try {
                          const blob = await githubApi.downloadArtifactBlob(token, owner, repo, art.id);
                          const buffer = await blob.arrayBuffer();
                          const base64 = uint8ArrayToBase64(new Uint8Array(buffer));
                          const path = `builds/${art.name}.zip`;
                          await githubApi.createOrUpdateFile(
                            token,
                            owner,
                            repo,
                            path,
                            base64,
                            `Store build artifact ${art.name} via GitBuddy`,
                            undefined,
                            branch
                          );
                          setSaveArtifactMsg(`Committed ${art.name} into /${path}!`);
                          onRefreshRepoFiles?.();
                          setTimeout(() => setSaveArtifactMsg(null), 3500);
                        } catch (err: unknown) {
                          alert(`Save to repo failed: ${err instanceof Error ? err.message : String(err)}`);
                        } finally {
                          setSavingArtifactId(null);
                        }
                      }}
                      disabled={savingArtifactId === art.id}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-200 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors flex items-center gap-1.5"
                      title="Store and commit this artifact directly into /builds in the repository"
                    >
                      {savingArtifactId === art.id ? (
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
        </div>
      )}

      {/* Available Workflows strip */}
      {workflows.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {workflows.map((wf) => (
            <div
              key={wf.id}
              className="bg-[#161b22] border border-[#30363d] rounded-xl p-3 flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-200 truncate">{wf.name}</div>
                <div className="text-[11px] text-slate-400 font-mono truncate">{wf.path}</div>
              </div>
              <button
                onClick={() => {
                  setDispatchWorkflowTarget(wf);
                  setDispatchBranch(branch);
                }}
                className="px-2.5 py-1 text-xs font-medium text-emerald-400 hover:text-white bg-emerald-950/40 hover:bg-emerald-600 border border-emerald-500/30 rounded-md transition-colors flex items-center gap-1 shrink-0"
              >
                <Play className="w-3 h-3 fill-current" />
                Dispatch
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Workflow Runs List */}
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 bg-[#0d1117]/80 border-b border-[#30363d] flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200">
            Recent Workflow Runs ({runs.length})
          </span>
          <span className="text-[11px] text-slate-400">
            Click any run to open real-time terminal logs
          </span>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2 text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            <span>Loading workflow runs...</span>
          </div>
        ) : runs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-3">
            <PlaySquare className="w-10 h-10 text-slate-600 mx-auto" />
            <p>No workflow runs found in this repository.</p>
            <button
              onClick={() => setIsNewWorkflowOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors"
            >
              Create Flutter or Python Workflow
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0d1117]/50 text-slate-400 border-b border-[#30363d]">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Run / Title</th>
                  <th className="py-2.5 px-4 font-medium hidden md:table-cell">Branch</th>
                  <th className="py-2.5 px-4 font-medium hidden sm:table-cell">Triggered By</th>
                  <th className="py-2.5 px-4 font-medium text-right">Time</th>
                  <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#21262d]">
                {runs.map((run) => (
                  <tr
                    key={run.id}
                    onClick={() => openRunDetails(run)}
                    className="hover:bg-[#21262d]/70 cursor-pointer transition-colors group"
                  >
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {getStatusBadge(run)}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-100 group-hover:text-emerald-400 transition-colors">
                        {run.name || run.display_title}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono truncate max-w-xs">
                        #{run.run_number} · {run.display_title}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-300 hidden md:table-cell">
                      {run.head_branch}
                    </td>
                    <td className="py-2.5 px-4 hidden sm:table-cell">
                      <div className="flex items-center gap-1.5">
                        <img
                          src={run.actor?.avatar_url}
                          alt=""
                          className="w-4 h-4 rounded-full"
                          referrerPolicy="no-referrer"
                        />
                        <span className="text-slate-300">{run.actor?.login}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-400 tabular-nums">
                      {new Date(run.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openRunDetails(run)}
                          className="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-[#30363d]"
                          title="Open logs terminal"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRerun(run.id)}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#30363d]"
                          title="Re-run workflow"
                        >
                          <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        {run.status === 'in_progress' && (
                          <button
                            onClick={() => handleCancelRun(run.id)}
                            className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-950/40"
                            title="Cancel run"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <a
                          href={run.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-[#30363d]"
                          title="Open on GitHub"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Real-time Execution Log Monitor Modal */}
      {selectedRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 lg:p-6 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-6xl w-full h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#30363d] bg-[#161b22]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Terminal className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white truncate">
                      Run #{selectedRun.run_number}: {selectedRun.name || selectedRun.display_title}
                    </h3>
                    {getStatusBadge(selectedRun)}
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Branch: {selectedRun.head_branch} · SHA: {selectedRun.head_sha.substring(0, 7)} · Triggered by @{selectedRun.actor?.login}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleCopyLogs}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-[#21262d] rounded-md transition-colors"
                  title="Copy logs"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={handleDownloadLogs}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-[#21262d] rounded-md transition-colors"
                  title="Download log file"
                >
                  <Download className="w-4 h-4" />
                </button>
                <a
                  href={selectedRun.html_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-[#21262d] rounded-md transition-colors"
                  title="View on GitHub"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setSelectedRun(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-md transition-colors ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Split View: Left (Jobs & Steps), Right (Live Terminal Logs) */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-[#0d1117]">
              {/* Left sidebar: Jobs and Steps */}
              <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#30363d] bg-[#161b22] p-3 overflow-y-auto space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Runner Jobs ({jobs.length})
                </div>
                <div className="space-y-1.5">
                  {jobs.map((job) => {
                    const isSelected = selectedJobId === job.id;
                    return (
                      <button
                        key={job.id}
                        onClick={() => handleSelectJob(job.id)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                          isSelected
                            ? 'bg-[#21262d] border-emerald-500/40 text-white shadow-xs'
                            : 'bg-[#0d1117] border-[#30363d] text-slate-300 hover:bg-[#21262d]/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold truncate">{job.name}</span>
                          {job.status === 'in_progress' ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                          ) : job.conclusion === 'success' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          )}
                        </div>
                        {job.steps && (
                          <div className="text-[10px] text-slate-500">
                            {job.steps.filter((s) => s.conclusion === 'success').length} / {job.steps.length} steps completed
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Terminal Console Output */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Search & terminal controls bar */}
                <div className="p-2.5 bg-[#161b22] border-b border-[#30363d] flex items-center justify-between gap-3 text-xs">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                      placeholder="Search within execution logs..."
                      className="w-full bg-[#0d1117] border border-[#30363d] rounded px-8 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-slate-400 text-xs cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoScroll}
                        onChange={(e) => setAutoScroll(e.target.checked)}
                        className="rounded border-[#30363d] text-emerald-600"
                      />
                      <span>Auto-scroll to bottom</span>
                    </label>

                    {selectedRun.status === 'in_progress' && (
                      <span className="text-amber-400 font-mono text-[11px] flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping inline-block" />
                        Live streaming
                      </span>
                    )}
                  </div>
                </div>

                {/* Log Text Viewport */}
                <div
                  ref={logsContainerRef}
                  className="flex-1 p-4 font-mono text-xs overflow-auto bg-[#0d1117] text-slate-300 leading-relaxed selection:bg-emerald-900/60"
                >
                  {isLoadingLogs ? (
                    <div className="h-full flex items-center justify-center gap-2 text-slate-400">
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                      <span>Streaming runner log bytes...</span>
                    </div>
                  ) : logsText ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: parseAnsiToHtml(
                          logSearch
                            ? logsText
                                .split('\n')
                                .filter((l) => l.toLowerCase().includes(logSearch.toLowerCase()))
                                .join('\n')
                            : logsText
                        ),
                      }}
                      className="whitespace-pre-wrap font-mono"
                    />
                  ) : (
                    <div className="text-slate-500 italic">No output generated yet for this job.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dispatch Workflow Modal */}
      {dispatchWorkflowTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#30363d]">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-400 fill-current" />
                Dispatch Workflow
              </h3>
              <button
                onClick={() => setDispatchWorkflowTarget(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleDispatch} className="space-y-4 py-4">
              {dispatchSuccessMsg && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-xs text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{dispatchSuccessMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Workflow</label>
                <div className="text-xs font-mono text-emerald-400 bg-[#0d1117] p-2 rounded border border-[#30363d]">
                  {dispatchWorkflowTarget.name} ({dispatchWorkflowTarget.path})
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Branch</label>
                <input
                  type="text"
                  value={dispatchBranch}
                  onChange={(e) => setDispatchBranch(e.target.value)}
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#30363d]">
                <button
                  type="button"
                  onClick={() => setDispatchWorkflowTarget(null)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isDispatching}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-1.5"
                >
                  {isDispatching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                  Trigger Run
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Workflow Template Creator Modal */}
      {isNewWorkflowOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 lg:p-6 bg-black/80 backdrop-blur-xs">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#30363d]">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Create GitHub Actions Workflow</h3>
              </div>
              <button
                onClick={() => setIsNewWorkflowOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkflowFile} className="flex-1 flex flex-col overflow-hidden">
              {newWorkflowError && (
                <div className="m-4 p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-300">
                  {newWorkflowError}
                </div>
              )}

              {/* Template selector pills */}
              <div className="p-3 bg-[#0d1117] border-b border-[#30363d] flex items-center gap-2 overflow-x-auto text-xs">
                <span className="text-slate-400 font-medium shrink-0">Presets:</span>
                {WORKFLOW_TEMPLATES.map((tpl) => (
                  <button
                    type="button"
                    key={tpl.id}
                    onClick={() => {
                      setSelectedTemplate(tpl);
                      setCustomWorkflowFilename(tpl.filename);
                      setCustomWorkflowContent(tpl.content);
                    }}
                    className={`px-2.5 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                      selectedTemplate.id === tpl.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-[#161b22] text-slate-300 hover:bg-[#21262d] border border-[#30363d]'
                    }`}
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>

              {/* Filename input */}
              <div className="p-3 bg-[#161b22] border-b border-[#30363d] flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-mono">.github/workflows/</span>
                <input
                  type="text"
                  required
                  value={customWorkflowFilename}
                  onChange={(e) => setCustomWorkflowFilename(e.target.value)}
                  className="flex-1 bg-[#0d1117] border border-[#30363d] rounded px-2.5 py-1 text-xs font-mono text-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              {/* YAML Editor */}
              <div className="flex-1 p-4 bg-[#0d1117] overflow-auto">
                <textarea
                  value={customWorkflowContent}
                  onChange={(e) => setCustomWorkflowContent(e.target.value)}
                  spellCheck={false}
                  className="w-full h-full bg-transparent text-slate-200 font-mono text-xs leading-5 resize-none focus:outline-none"
                  placeholder="Paste or write GitHub Actions YAML configuration..."
                />
              </div>

              {/* Footer */}
              <div className="p-4 bg-[#161b22] border-t border-[#30363d] flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  Will commit to branch <code className="text-emerald-400">{branch}</code>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsNewWorkflowOpen(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingWorkflow || !customWorkflowFilename.trim()}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors flex items-center gap-1.5"
                  >
                    {isSubmittingWorkflow ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    Commit Workflow File
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

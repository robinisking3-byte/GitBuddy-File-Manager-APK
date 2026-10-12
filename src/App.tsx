import React, { useState, useEffect, useCallback } from 'react';
import {
  getStoredToken,
  saveStoredToken,
  clearStoredToken,
  githubApi,
  base64ToUtf8,
} from './services/githubApi';
import {
  testFirestoreConnection,
  savePatAccountToFirestore,
} from './services/firebase';
import { GitHubUser, GitHubRepo, RepoBranch, RepoContentItem } from './types/github';
import { Navbar } from './components/Navbar';
import { FileManager } from './components/FileManager';
import { WorkflowsManager } from './components/WorkflowsManager';
import { RepoWorkflowsSection } from './components/RepoWorkflowsSection';
import { ZipExtractorModal } from './components/ZipExtractorModal';
import { BatchUploadModal } from './components/BatchUploadModal';
import { RepoSelectorModal } from './components/RepoSelectorModal';
import { CreateRepoModal } from './components/CreateRepoModal';
import { TokenSettingsModal } from './components/TokenSettingsModal';
import { MultiAccountModal } from './components/MultiAccountModal';
import { NotificationBanner } from './components/NotificationBanner';
import { NotificationPermissionPrompt } from './components/NotificationPermissionPrompt';
import { FileViewerModal } from './components/FileViewerModal';
import { FileEditorModal } from './components/FileEditorModal';
import { DownloadApkModal } from './components/DownloadApkModal';
import { ReposListView } from './components/ReposListView';
import { CommitHistory } from './components/CommitHistory';
import { AccountConnectedTransition } from './components/AccountConnectedTransition';
import {
  Loader2,
  AlertTriangle,
  KeyRound,
  FolderPlus,
  Users,
  Database,
  Plus,
  Check,
  ShieldCheck,
  PlaySquare,
  Package,
} from 'lucide-react';

export default function App() {
  const [token, setToken] = useState<string>(getStoredToken());
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [activeRepo, setActiveRepo] = useState<GitHubRepo | null>(null);
  const [branches, setBranches] = useState<RepoBranch[]>([]);
  const [activeBranch, setActiveBranch] = useState<string>('main');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [contents, setContents] = useState<RepoContentItem[]>([]);

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'files' | 'workflows' | 'zip' | 'repos' | 'commits'>('files');

  // Account connected celebration transition
  const [connectedTransition, setConnectedTransition] = useState<{
    isVisible: boolean;
    username: string;
    avatarUrl?: string;
  }>({
    isVisible: false,
    username: '',
    avatarUrl: '',
  });

  // Loading & error states
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isLoadingContents, setIsLoadingContents] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Login state
  const [loginInputToken, setLoginInputToken] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Modals state
  const [isTokenModalOpen, setIsTokenModalOpen] = useState<boolean>(false);
  const [isAccountsModalOpen, setIsAccountsModalOpen] = useState<boolean>(false);
  const [isRepoSelectorOpen, setIsRepoSelectorOpen] = useState<boolean>(false);
  const [isCreateRepoOpen, setIsCreateRepoOpen] = useState<boolean>(false);
  const [isZipModalOpen, setIsZipModalOpen] = useState<boolean>(false);
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [isApkModalOpen, setIsApkModalOpen] = useState<boolean>(false);

  // File Viewer & Editor modals state
  const [viewingFile, setViewingFile] = useState<RepoContentItem | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState<boolean>(false);
  const [editingFile, setEditingFile] = useState<RepoContentItem | null>(null);
  const [editorInitialContent, setEditorInitialContent] = useState<string>('');
  const [editorTargetFolder, setEditorTargetFolder] = useState<string>('');
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);

  // 1. Initial boot: Test Firestore connection
  useEffect(() => {
    testFirestoreConnection();
  }, []);

  // 2. Initialize active user & repos when token changes
  const initApp = useCallback(async (patToken: string) => {
    if (!patToken || patToken.trim().length === 0) {
      setUser(null);
      setRepos([]);
      setActiveRepo(null);
      setIsInitializing(false);
      return;
    }

    setIsInitializing(true);
    setAuthError(null);

    try {
      const [userData, repoList] = await Promise.all([
        githubApi.getUser(patToken),
        githubApi.getRepos(patToken, { sort: 'updated', per_page: 50 }),
      ]);

      setUser(userData);
      setRepos(repoList);

      // Automatically store/update in Firebase in format { username, patToken }
      try {
        await savePatAccountToFirestore({
          username: userData.login,
          patToken: patToken.trim(),
          avatarUrl: userData.avatar_url,
        });
      } catch (fbErr) {
        console.warn('Could not sync account to Firebase Firestore:', fbErr);
      }

      if (repoList.length > 0) {
        const initialRepo = repoList[0];
        setActiveRepo(initialRepo);
        const branchName = initialRepo.default_branch || 'main';
        setActiveBranch(branchName);

        try {
          const owner = initialRepo.owner?.login || userData.login;
          const branchList = await githubApi.getBranches(patToken, owner, initialRepo.name);
          setBranches(branchList);
        } catch {
          setBranches([{ name: branchName, commit: { sha: '', url: '' }, protected: false }]);
        }
      } else {
        setActiveRepo(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setAuthError(`Authentication Notice: ${msg}`);
      setUser(null);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    initApp(token);
  }, [token, initApp]);

  // 3. Fetch Directory Contents
  const loadDirectoryContents = useCallback(async () => {
    if (!activeRepo || !token) return;
    setIsLoadingContents(true);

    try {
      const owner = activeRepo.owner?.login || user?.login || activeRepo.full_name.split('/')[0];
      const data = await githubApi.getContents(
        token,
        owner,
        activeRepo.name,
        currentPath,
        activeBranch
      );

      if (Array.isArray(data)) {
        setContents(data);
      } else if (data) {
        setContents([data]);
      } else {
        setContents([]);
      }
    } catch (err) {
      console.warn('Failed to load directory contents:', err);
      setContents([]);
    } finally {
      setIsLoadingContents(false);
    }
  }, [activeRepo, activeBranch, currentPath, token, user]);

  useEffect(() => {
    if (activeRepo && token) {
      loadDirectoryContents();
    }
  }, [activeRepo, activeBranch, currentPath, token, loadDirectoryContents]);

  // Login handler
  const handleManualLogin = async (tokenToUse: string) => {
    if (!tokenToUse.trim()) return;
    setIsLoggingIn(true);
    setLoginError(null);

    try {
      const u = await githubApi.getUser(tokenToUse.trim());
      saveStoredToken(tokenToUse.trim());
      setToken(tokenToUse.trim());

      await savePatAccountToFirestore({
        username: u.login,
        patToken: tokenToUse.trim(),
        avatarUrl: u.avatar_url,
      });

      setLoginInputToken('');

      // Trigger smooth celebration transition
      setConnectedTransition({
        isVisible: true,
        username: u.login,
        avatarUrl: u.avatar_url,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLoginError(`Login failed: ${msg}`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSwitchAccount = (account: { username: string; patToken: string; avatarUrl?: string }) => {
    saveStoredToken(account.patToken);
    setToken(account.patToken);
    setConnectedTransition({
      isVisible: true,
      username: account.username,
      avatarUrl: account.avatarUrl,
    });
  };

  const handleLogout = () => {
    clearStoredToken();
    setToken('');
    setUser(null);
    setActiveRepo(null);
    setRepos([]);
  };

  const handleSelectRepo = async (repo: GitHubRepo) => {
    setActiveRepo(repo);
    setCurrentPath('');
    const defaultBr = repo.default_branch || 'main';
    setActiveBranch(defaultBr);
    setActiveTab('files');

    try {
      const owner = repo.owner?.login || user?.login || repo.full_name.split('/')[0];
      const bList = await githubApi.getBranches(token, owner, repo.name);
      setBranches(bList);
    } catch {
      setBranches([{ name: defaultBr, commit: { sha: '', url: '' }, protected: false }]);
    }
  };

  const handleSelectBranch = (br: string) => {
    setActiveBranch(br);
    setCurrentPath('');
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (token) {
      await Promise.all([
        initApp(token),
        loadDirectoryContents(),
      ]);
    }
    setIsRefreshing(false);
  };

  const handleOpenFileViewer = async (item: RepoContentItem) => {
    if (!activeRepo) return;
    try {
      let fileData = item;
      if (!item.content) {
        const owner = activeRepo.owner?.login || user?.login || activeRepo.full_name.split('/')[0];
        const res = await githubApi.getContents(token, owner, activeRepo.name, item.path, activeBranch);
        if (!Array.isArray(res)) {
          fileData = res;
        }
      }
      setViewingFile(fileData);
      setIsViewerOpen(true);
    } catch (err) {
      alert(`Could not load file: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleOpenFileEditor = (item: RepoContentItem, rawContent?: string) => {
    setEditingFile(item);
    setEditorInitialContent(rawContent !== undefined ? rawContent : (item.content ? base64ToUtf8(item.content) : ''));
    setEditorTargetFolder('');
    setIsEditorOpen(true);
  };

  const handleOpenCreateFile = (targetFolder: string) => {
    setEditingFile(null);
    setEditorInitialContent('');
    setEditorTargetFolder(targetFolder);
    setIsEditorOpen(true);
  };

  const handleRepoCreated = (newRepo: GitHubRepo) => {
    setRepos((prev) => [newRepo, ...prev]);
    handleSelectRepo(newRepo);
  };

  const handleRepoDeleted = (deletedFullName: string) => {
    setRepos((prev) => prev.filter((r) => r.full_name !== deletedFullName));
    if (activeRepo?.full_name === deletedFullName) {
      const remaining = repos.filter((r) => r.full_name !== deletedFullName);
      if (remaining.length > 0) {
        handleSelectRepo(remaining[0]);
      } else {
        setActiveRepo(null);
      }
    }
  };

  const activeOwner = activeRepo?.owner?.login || user?.login || activeRepo?.full_name.split('/')[0] || '';

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3] flex flex-col font-sans">
      {/* Top Bar Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        activeRepo={activeRepo}
        activeBranch={activeBranch}
        branches={branches}
        onSelectBranch={handleSelectBranch}
        onOpenRepoSelector={() => setIsRepoSelectorOpen(true)}
        onOpenTokenSettings={() => setIsTokenModalOpen(true)}
        onOpenAccountsModal={() => setIsAccountsModalOpen(true)}
        onOpenDownloadApk={() => setIsApkModalOpen(true)}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Real-time Push Notification Toast Banner */}
      <NotificationBanner onOpenWorkflowsTab={() => setActiveTab('workflows')} />

      {/* Main Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6 space-y-4">
        {/* State A: No Token / Logged Out View (Multi-account Login Hub) */}
        {!token ? (
          <div className="max-w-xl mx-auto my-10 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 sm:p-8 shadow-2xl text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden border border-emerald-500/30 flex items-center justify-center bg-[#0d1117] mx-auto shadow-lg ring-2 ring-emerald-500/20 p-1">
                <img src="/logo.svg" alt="GitBuddy Logo" className="w-full h-full object-cover rounded-xl" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Login to GitBuddy</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Connect your GitHub Personal Access Token. Securely managed and synced to Firestore.
                </p>
              </div>

              {loginError && (
                <div className="p-3 bg-rose-950/40 border border-rose-500/40 rounded-lg text-xs text-rose-300 text-left flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{loginError}</span>
                </div>
              )}

              {/* Login Form */}
              <div className="space-y-3 text-left">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    GitHub Personal Access Token (PAT)
                  </label>
                  <input
                    type="password"
                    value={loginInputToken}
                    onChange={(e) => setLoginInputToken(e.target.value)}
                    placeholder="github_pat_... or ghp_..."
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3.5 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <div className="mt-1.5 text-[11px] text-slate-400">
                    Tokens are securely saved in Firebase Firestore and your local browser session.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleManualLogin(loginInputToken)}
                  disabled={isLoggingIn || !loginInputToken.trim()}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg transition-colors flex items-center justify-center gap-2 shadow-xs"
                >
                  {isLoggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authenticating & Storing Account...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Connect GitHub Account</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : isInitializing ? (
          <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
            <div className="text-sm font-medium text-slate-200">Connecting to GitHub via GitBuddy...</div>
            <div className="text-xs text-slate-500">Loading user profile, repositories, and workflows</div>
          </div>
        ) : authError ? (
          <div className="bg-[#161b22] border border-rose-500/40 rounded-xl p-8 max-w-lg mx-auto text-center space-y-4 my-12 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">GitHub Authentication Notice</h3>
              <p className="text-xs text-slate-400 mt-1">{authError}</p>
            </div>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setIsAccountsModalOpen(true)}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors inline-flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Switch or Add PAT Account
              </button>
            </div>
          </div>
        ) : !activeRepo && activeTab !== 'repos' ? (
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-12 text-center max-w-lg mx-auto space-y-4 my-12 shadow-xl">
            <FolderPlus className="w-12 h-12 text-emerald-400 mx-auto" />
            <div>
              <h3 className="text-base font-semibold text-white">No Repositories Found</h3>
              <p className="text-xs text-slate-400 mt-1">
                Create your first GitHub repository to start managing files, extracting ZIPs, and tracking actions.
              </p>
            </div>
            <button
              onClick={() => setIsCreateRepoOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors inline-flex items-center gap-2"
            >
              Create Repository
            </button>
          </div>
        ) : (
          <>
            {/* Required Permission Prompt: Allow Push Notifications */}
            <NotificationPermissionPrompt />

            {/* View Tab 1: File Manager */}
            {activeTab === 'files' && activeRepo && (
              <div className="space-y-6">
                <FileManager
                  repo={activeRepo}
                  branch={activeBranch}
                  token={token}
                  currentPath={currentPath}
                  contents={contents}
                  isLoading={isLoadingContents}
                  onNavigatePath={(p) => setCurrentPath(p)}
                  onOpenFileViewer={handleOpenFileViewer}
                  onOpenFileEditor={(item) => handleOpenFileEditor(item)}
                  onOpenCreateFile={handleOpenCreateFile}
                  onOpenZipExtractor={() => setIsZipModalOpen(true)}
                  onOpenBatchUpload={() => setIsBatchModalOpen(true)}
                  onRefreshDirectory={loadDirectoryContents}
                  onOpenWorkflows={() => setActiveTab('workflows')}
                  onOpenCommits={() => setActiveTab('commits')}
                />

                {/* Embedded Workflows & Output Artifacts Section in Every Repo */}
                <RepoWorkflowsSection
                  repo={activeRepo}
                  token={token}
                  branch={activeBranch}
                  onOpenLiveLogs={() => setActiveTab('workflows')}
                  onRefreshRepoFiles={loadDirectoryContents}
                />
              </div>
            )}

            {/* View Tab 2: ZIP & Batch Upload dedicated workspace */}
            {activeTab === 'zip' && activeRepo && (
              <div className="space-y-6">
                <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 shadow-xs">
                  <h2 className="text-base font-semibold text-white mb-1">
                    ZIP Archive Extractor & Folder Batch Uploader
                  </h2>
                  <p className="text-xs text-slate-400 max-w-2xl mb-4">
                    Upload any .zip archive or multi-folder batch. GitBuddy unzips files client-side, maps the exact folder tree, and pushes an atomic Git commit directly to <span className="font-mono text-emerald-400">{activeRepo.full_name}@{activeBranch}</span>.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsZipModalOpen(true)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-md transition-colors shadow-xs"
                    >
                      Open ZIP Extractor Modal
                    </button>
                    <button
                      onClick={() => setIsBatchModalOpen(true)}
                      className="px-4 py-2 text-xs font-medium text-slate-200 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-md transition-colors"
                    >
                      Open Folder Dropzone
                    </button>
                  </div>
                </div>

                <FileManager
                  repo={activeRepo}
                  branch={activeBranch}
                  token={token}
                  currentPath={currentPath}
                  contents={contents}
                  isLoading={isLoadingContents}
                  onNavigatePath={(p) => setCurrentPath(p)}
                  onOpenFileViewer={handleOpenFileViewer}
                  onOpenFileEditor={(item) => handleOpenFileEditor(item)}
                  onOpenCreateFile={handleOpenCreateFile}
                  onOpenZipExtractor={() => setIsZipModalOpen(true)}
                  onOpenBatchUpload={() => setIsBatchModalOpen(true)}
                  onRefreshDirectory={loadDirectoryContents}
                  onOpenWorkflows={() => setActiveTab('workflows')}
                />
              </div>
            )}

            {/* View Tab 3: Workflows & GitHub Actions (with Build Output Artifacts & Live Logs) */}
            {activeTab === 'workflows' && activeRepo && (
              <div className="space-y-6">
                <WorkflowsManager
                  token={token}
                  owner={activeOwner}
                  repo={activeRepo.name}
                  branch={activeBranch}
                  onRefreshRepoFiles={loadDirectoryContents}
                />
              </div>
            )}

            {/* View Tab 4: Commit History dedicated workspace */}
            {activeTab === 'commits' && activeRepo && (
              <div className="space-y-6">
                <CommitHistory
                  repo={activeRepo}
                  branch={activeBranch}
                  token={token}
                  branches={branches}
                  onSelectBranch={setActiveBranch}
                />
              </div>
            )}

            {/* View Tab 5: Repositories List */}
            {activeTab === 'repos' && (
              <ReposListView
                repos={repos}
                activeRepo={activeRepo}
                onSelectRepo={handleSelectRepo}
                onOpenCreateRepo={() => setIsCreateRepoOpen(true)}
                onOpenZipForRepo={(r) => {
                  handleSelectRepo(r);
                  setIsZipModalOpen(true);
                }}
                onOpenWorkflowsForRepo={(r) => {
                  handleSelectRepo(r);
                  setActiveTab('workflows');
                }}
                onOpenRepoDelete={() => {
                  setIsRepoSelectorOpen(true);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Account Connected Smooth Celebration Transition */}
      <AccountConnectedTransition
        isVisible={connectedTransition.isVisible}
        username={connectedTransition.username}
        avatarUrl={connectedTransition.avatarUrl}
        onTransitionEnd={() => setConnectedTransition({ isVisible: false, username: '', avatarUrl: '' })}
      />

      {/* Global Modals */}
      {/* 1. Multi-Account PAT Manager Modal (Stored in Firestore) */}
      <MultiAccountModal
        isOpen={isAccountsModalOpen}
        onClose={() => setIsAccountsModalOpen(false)}
        activeToken={token}
        activeUsername={user?.login || ''}
        onSwitchAccount={handleSwitchAccount}
        onLogoutCurrent={handleLogout}
      />

      {/* 2. Token Settings Modal */}
      <TokenSettingsModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        currentToken={token}
        currentUser={user}
        onTokenUpdated={(newToken) => {
          saveStoredToken(newToken);
          setToken(newToken);
        }}
      />

      {/* 3. ZIP Extractor Modal */}
      {activeRepo && (
        <ZipExtractorModal
          isOpen={isZipModalOpen}
          onClose={() => setIsZipModalOpen(false)}
          token={token}
          owner={activeOwner}
          repo={activeRepo.name}
          branch={activeBranch}
          currentPath={currentPath}
          onExtractedAndPushed={() => {
            loadDirectoryContents();
          }}
        />
      )}

      {/* 4. Batch Upload Modal */}
      {activeRepo && (
        <BatchUploadModal
          isOpen={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          token={token}
          owner={activeOwner}
          repo={activeRepo.name}
          branch={activeBranch}
          currentPath={currentPath}
          onUploaded={() => {
            loadDirectoryContents();
          }}
        />
      )}

      {/* 5. Repo Selector Modal */}
      <RepoSelectorModal
        isOpen={isRepoSelectorOpen}
        onClose={() => setIsRepoSelectorOpen(false)}
        repos={repos}
        activeRepo={activeRepo}
        onSelectRepo={handleSelectRepo}
        onOpenCreateModal={() => setIsCreateRepoOpen(true)}
        token={token}
        onRepoDeleted={handleRepoDeleted}
      />

      {/* 6. Create Repo Modal */}
      <CreateRepoModal
        isOpen={isCreateRepoOpen}
        onClose={() => setIsCreateRepoOpen(false)}
        token={token}
        onRepoCreated={handleRepoCreated}
      />

      {/* 7. File Viewer Modal */}
      <FileViewerModal
        isOpen={isViewerOpen}
        onClose={() => setIsViewerOpen(false)}
        fileItem={viewingFile}
        onOpenEditor={(item, content) => handleOpenFileEditor(item, content)}
        onDeleteFile={() => {
          setIsViewerOpen(false);
          loadDirectoryContents();
        }}
      />

      {/* 8. File Editor Modal */}
      {activeRepo && (
        <FileEditorModal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          token={token}
          owner={activeOwner}
          repo={activeRepo.name}
          branch={activeBranch}
          fileItem={editingFile}
          initialContent={editorInitialContent}
          targetFolder={editorTargetFolder}
          onFileSaved={() => {
            loadDirectoryContents();
          }}
        />
      )}

      {/* 9. Production Android APK Download Modal */}
      <DownloadApkModal
        isOpen={isApkModalOpen}
        onClose={() => setIsApkModalOpen(false)}
        activeRepoName={activeRepo?.full_name}
        onNavigateToWorkflows={() => setActiveTab('workflows')}
      />
    </div>
  );
}

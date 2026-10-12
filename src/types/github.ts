export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  total_private_repos?: number;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    id: number;
    avatar_url: string;
    html_url?: string;
  };
  html_url: string;
  description: string | null;
  fork: boolean;
  default_branch: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  open_issues_count: number;
  visibility?: string;
  permissions?: {
    admin: boolean;
    push: boolean;
    pull: boolean;
  };
}

export interface RepoBranch {
  name: string;
  commit: {
    sha: string;
    url: string;
  };
  protected: boolean;
}

export interface RepoContentItem {
  name: string;
  path: string;
  sha: string;
  size: number;
  url: string;
  html_url: string;
  git_url: string;
  download_url: string | null;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  content?: string;
  encoding?: string;
}

export interface Workflow {
  id: number;
  node_id: string;
  name: string;
  path: string;
  state: string;
  created_at: string;
  updated_at: string;
  url: string;
  html_url: string;
  badge_url: string;
}

export interface WorkflowRun {
  id: number;
  name: string;
  node_id: string;
  head_branch: string;
  head_sha: string;
  path: string;
  display_title: string;
  run_number: number;
  event: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting' | string;
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out' | 'action_required' | 'skipped' | null;
  workflow_id: number;
  url: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  actor: {
    login: string;
    avatar_url: string;
  };
  run_attempt: number;
}

export interface WorkflowJob {
  id: number;
  run_id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | null;
  started_at: string;
  completed_at: string | null;
  steps: {
    name: string;
    status: 'queued' | 'in_progress' | 'completed';
    conclusion: 'success' | 'failure' | 'skipped' | null;
    number: number;
    started_at?: string;
    completed_at?: string;
  }[];
}

export interface WorkflowArtifact {
  id: number;
  node_id: string;
  name: string;
  size_in_bytes: number;
  url: string;
  archive_download_url: string;
  expired: boolean;
  created_at: string;
  expires_at: string;
  updated_at: string;
  workflow_run?: {
    id: number;
    repository_id: number;
    head_repository_id: number;
    head_branch: string;
    head_sha: string;
  };
}

export interface SavedPatAccount {
  username: string;
  patToken: string;
  avatarUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

export interface GitCommitFile {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  raw_url?: string;
  blob_url?: string;
}

export interface GitCommitItem {
  sha: string;
  node_id?: string;
  commit: {
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
    message: string;
    tree: {
      sha: string;
      url: string;
    };
    url: string;
    comment_count: number;
    verification?: {
      verified: boolean;
      reason: string;
      signature: string | null;
      payload: string | null;
      verified_at?: string | null;
    };
  };
  url: string;
  html_url: string;
  comments_url?: string;
  author: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  } | null;
  committer: {
    login: string;
    id: number;
    avatar_url: string;
    html_url: string;
  } | null;
  parents: {
    sha: string;
    url: string;
    html_url?: string;
  }[];
  stats?: {
    total: number;
    additions: number;
    deletions: number;
  };
  files?: GitCommitFile[];
}


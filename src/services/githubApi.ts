import {
  GitHubUser,
  GitHubRepo,
  RepoBranch,
  RepoContentItem,
  Workflow,
  WorkflowRun,
  WorkflowJob,
  WorkflowArtifact,
  RateLimitInfo,
  GitCommitItem,
} from '../types/github';

export const DEFAULT_GITHUB_TOKEN = '';

const GITHUB_API_BASE = 'https://api.github.com';

export function getStoredToken(): string {
  const stored = localStorage.getItem('gitbuddy_pat_token');
  if (stored && stored.trim().length > 0) {
    return stored.trim();
  }
  return '';
}

export function saveStoredToken(token: string): void {
  localStorage.setItem('gitbuddy_pat_token', token.trim());
}

export function clearStoredToken(): void {
  localStorage.removeItem('gitbuddy_pat_token');
}

function getHeaders(token: string, accept = 'application/vnd.github.v3+json'): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: accept,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `GitHub API error (${res.status} ${res.statusText})`;
    try {
      const errorJson = await res.json();
      if (errorJson.message) {
        errorMsg = errorJson.message;
        if (errorJson.errors && Array.isArray(errorJson.errors)) {
          errorMsg += `: ${errorJson.errors.map((e: { message?: string }) => e.message || JSON.stringify(e)).join(', ')}`;
        }
      }
    } catch {
      const text = await res.text();
      if (text) errorMsg = text.slice(0, 300);
    }
    throw new Error(errorMsg);
  }
  if (res.status === 204) {
    return {} as T;
  }
  return res.json() as Promise<T>;
}

// Convert bytes to base64 safely without callstack limit
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

// Convert base64 to string
export function base64ToUtf8(base64: string): string {
  try {
    const binary = atob(base64.replace(/\n/g, ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (err) {
    console.warn('UTF-8 decode error, falling back to atob', err);
    return atob(base64.replace(/\n/g, ''));
  }
}

// Convert utf-8 string to base64
export function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  return uint8ArrayToBase64(bytes);
}

export const githubApi = {
  // Current Authenticated User
  async getUser(token: string): Promise<GitHubUser> {
    const res = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: getHeaders(token),
    });
    return handleResponse<GitHubUser>(res);
  },

  // Rate Limits
  async getRateLimit(token: string): Promise<RateLimitInfo> {
    const res = await fetch(`${GITHUB_API_BASE}/rate_limit`, {
      headers: getHeaders(token),
    });
    const data = await handleResponse<{ rate: RateLimitInfo }>(res);
    return data.rate;
  },

  // Repositories
  async getRepos(
    token: string,
    params: { sort?: 'updated' | 'created' | 'pushed' | 'full_name'; per_page?: number; page?: number; type?: string } = {}
  ): Promise<GitHubRepo[]> {
    const searchParams = new URLSearchParams({
      sort: params.sort || 'updated',
      direction: 'desc',
      per_page: String(params.per_page || 100),
      page: String(params.page || 1),
      affiliation: 'owner,collaborator,organization_member',
    });
    const res = await fetch(`${GITHUB_API_BASE}/user/repos?${searchParams.toString()}`, {
      headers: getHeaders(token),
    });
    return handleResponse<GitHubRepo[]>(res);
  },

  async getRepo(token: string, owner: string, repo: string): Promise<GitHubRepo> {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: getHeaders(token),
    });
    return handleResponse<GitHubRepo>(res);
  },

  async createRepo(
    token: string,
    data: {
      name: string;
      description?: string;
      private: boolean;
      auto_init?: boolean;
      gitignore_template?: string;
      license_template?: string;
    }
  ): Promise<GitHubRepo> {
    const res = await fetch(`${GITHUB_API_BASE}/user/repos`, {
      method: 'POST',
      headers: {
        ...getHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return handleResponse<GitHubRepo>(res);
  },

  async deleteRepo(token: string, owner: string, repo: string): Promise<void> {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      method: 'DELETE',
      headers: getHeaders(token),
    });
    await handleResponse(res);
  },

  // Branches
  async getBranches(token: string, owner: string, repo: string): Promise<RepoBranch[]> {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/branches?per_page=100`, {
      headers: getHeaders(token),
    });
    return handleResponse<RepoBranch[]>(res);
  },

  async createBranch(token: string, owner: string, repo: string, branchName: string, fromSha: string): Promise<void> {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs`, {
      method: 'POST',
      headers: {
        ...getHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: fromSha,
      }),
    });
    await handleResponse(res);
  },

  // Commits & History
  async getCommits(
    token: string,
    owner: string,
    repo: string,
    params: { sha?: string; path?: string; per_page?: number; page?: number } = {}
  ): Promise<GitCommitItem[]> {
    const searchParams = new URLSearchParams();
    if (params.sha) searchParams.set('sha', params.sha);
    if (params.path) searchParams.set('path', params.path);
    searchParams.set('per_page', String(params.per_page || 30));
    searchParams.set('page', String(params.page || 1));

    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?${searchParams.toString()}`, {
      headers: getHeaders(token),
    });
    return handleResponse<GitCommitItem[]>(res);
  },

  async getCommit(token: string, owner: string, repo: string, ref: string): Promise<GitCommitItem> {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${ref}`, {
      headers: getHeaders(token),
    });
    return handleResponse<GitCommitItem>(res);
  },

  // Directory & File Contents
  async getContents(
    token: string,
    owner: string,
    repo: string,
    path: string = '',
    ref?: string
  ): Promise<RepoContentItem[] | RepoContentItem> {
    const cleanPath = path.replace(/^\/+|\/+$/g, '');
    const url = new URL(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${cleanPath}`);
    if (ref) url.searchParams.set('ref', ref);

    const res = await fetch(url.toString(), {
      headers: getHeaders(token),
    });
    return handleResponse<RepoContentItem[] | RepoContentItem>(res);
  },

  async createOrUpdateFile(
    token: string,
    owner: string,
    repo: string,
    path: string,
    contentBase64: string,
    message: string,
    sha?: string,
    branch?: string
  ): Promise<{ content: RepoContentItem; commit: { sha: string } }> {
    const cleanPath = path.replace(/^\/+/, '');
    const body: Record<string, unknown> = {
      message,
      content: contentBase64,
    };
    if (sha) body.sha = sha;
    if (branch) body.branch = branch;

    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${cleanPath}`, {
      method: 'PUT',
      headers: {
        ...getHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return handleResponse(res);
  },

  async deleteFile(
    token: string,
    owner: string,
    repo: string,
    path: string,
    sha: string,
    message: string,
    branch?: string
  ): Promise<void> {
    const cleanPath = path.replace(/^\/+/, '');
    const body: Record<string, unknown> = {
      message,
      sha,
    };
    if (branch) body.branch = branch;

    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${cleanPath}`, {
      method: 'DELETE',
      headers: {
        ...getHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    await handleResponse(res);
  },

  // Atomic batch commit for ZIP extracts & Folder Uploads using GitHub Git Data API
  async batchCommitViaTree(
    token: string,
    owner: string,
    repo: string,
    branch: string,
    files: { path: string; base64Content: string }[],
    commitMessage: string,
    onProgress?: (message: string, percent: number) => void
  ): Promise<{ commitSha: string }> {
    if (files.length === 0) {
      throw new Error('No files provided to commit');
    }

    onProgress?.('Fetching branch head reference...', 5);
    // 1. Get branch reference
    let refRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/heads/${branch}`, {
      headers: getHeaders(token),
    });

    // If branch doesn't exist, try getting default branch or HEAD
    let parentCommitSha = '';
    let baseTreeSha: string | undefined = undefined;

    if (refRes.ok) {
      const refData = await refRes.json();
      parentCommitSha = refData.object.sha;

      // 2. Get parent commit to find base_tree
      const commitRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits/${parentCommitSha}`, {
        headers: getHeaders(token),
      });
      if (commitRes.ok) {
        const commitData = await commitRes.json();
        baseTreeSha = commitData.tree.sha;
      }
    } else {
      // Empty repo or newly created repo without any branch ref yet
      onProgress?.('Initializing root tree on repository...', 10);
    }

    // 3. Upload blobs in chunks
    const treeEntries: { path: string; mode: string; type: string; sha: string }[] = [];
    const totalFiles = files.length;
    const blobBatchSize = 5;

    for (let i = 0; i < totalFiles; i += blobBatchSize) {
      const chunk = files.slice(i, i + blobBatchSize);
      const promises = chunk.map(async (file) => {
        const cleanPath = file.path.replace(/^\/+/, '');
        const blobRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/blobs`, {
          method: 'POST',
          headers: {
            ...getHeaders(token),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            content: file.base64Content,
            encoding: 'base64',
          }),
        });
        const blobData = await handleResponse<{ sha: string }>(blobRes);
        return {
          path: cleanPath,
          mode: '100644',
          type: 'blob',
          sha: blobData.sha,
        };
      });

      const uploadedBlobs = await Promise.all(promises);
      treeEntries.push(...uploadedBlobs);

      const progressPercent = Math.min(80, Math.round(10 + ((i + chunk.length) / totalFiles) * 70));
      onProgress?.(
        `Uploaded blobs (${Math.min(i + chunk.length, totalFiles)} / ${totalFiles} files)...`,
        progressPercent
      );
    }

    // 4. Create new tree
    onProgress?.('Generating Git tree snapshot...', 85);
    const treePayload: Record<string, unknown> = {
      tree: treeEntries,
    };
    if (baseTreeSha) {
      treePayload.base_tree = baseTreeSha;
    }

    const newTreeRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers: {
        ...getHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(treePayload),
    });
    const newTreeData = await handleResponse<{ sha: string }>(newTreeRes);

    // 5. Create commit
    onProgress?.('Recording Git commit...', 92);
    const commitPayload: Record<string, unknown> = {
      message: commitMessage,
      tree: newTreeData.sha,
      parents: parentCommitSha ? [parentCommitSha] : [],
    };

    const newCommitRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers: {
        ...getHeaders(token),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commitPayload),
    });
    const newCommitData = await handleResponse<{ sha: string }>(newCommitRes);

    // 6. Update or create branch reference
    onProgress?.(`Updating branch ref refs/heads/${branch}...`, 97);
    if (parentCommitSha) {
      const updateRefRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        method: 'PATCH',
        headers: {
          ...getHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sha: newCommitData.sha,
          force: false,
        }),
      });
      await handleResponse(updateRefRes);
    } else {
      const createRefRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        headers: {
          ...getHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${branch}`,
          sha: newCommitData.sha,
        }),
      });
      await handleResponse(createRefRes);
    }

    onProgress?.('All files published successfully!', 100);
    return { commitSha: newCommitData.sha };
  },

  // Workflows & GitHub Actions
  async getWorkflows(token: string, owner: string, repo: string): Promise<Workflow[]> {
    try {
      const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows`, {
        headers: getHeaders(token),
      });
      const data = await handleResponse<{ total_count: number; workflows: Workflow[] }>(res);
      return data.workflows || [];
    } catch (err) {
      console.warn('Could not fetch workflows from Actions API', err);
      return [];
    }
  },

  async getWorkflowRuns(
    token: string,
    owner: string,
    repo: string,
    workflowId?: number,
    perPage = 25
  ): Promise<WorkflowRun[]> {
    try {
      const endpoint = workflowId
        ? `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=${perPage}`
        : `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`;

      const res = await fetch(endpoint, {
        headers: getHeaders(token),
      });
      const data = await handleResponse<{ total_count: number; workflow_runs: WorkflowRun[] }>(res);
      return data.workflow_runs || [];
    } catch (err) {
      console.warn('Could not fetch workflow runs', err);
      return [];
    }
  },

  async getWorkflowRun(token: string, owner: string, repo: string, runId: number): Promise<WorkflowRun> {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}`, {
      headers: getHeaders(token),
    });
    return handleResponse<WorkflowRun>(res);
  },

  async dispatchWorkflow(
    token: string,
    owner: string,
    repo: string,
    workflowIdOrFileName: string | number,
    ref: string,
    inputs: Record<string, string> = {}
  ): Promise<void> {
    const res = await fetch(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/workflows/${workflowIdOrFileName}/dispatches`,
      {
        method: 'POST',
        headers: {
          ...getHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref,
          inputs,
        }),
      }
    );
    await handleResponse(res);
  },

  async cancelWorkflowRun(token: string, owner: string, repo: string, runId: number): Promise<void> {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}/cancel`, {
      method: 'POST',
      headers: getHeaders(token),
    });
    await handleResponse(res);
  },

  async rerunWorkflow(token: string, owner: string, repo: string, runId: number): Promise<void> {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}/rerun`, {
      method: 'POST',
      headers: getHeaders(token),
    });
    await handleResponse(res);
  },

  async getWorkflowJobs(token: string, owner: string, repo: string, runId: number): Promise<WorkflowJob[]> {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}/jobs`, {
      headers: getHeaders(token),
    });
    const data = await handleResponse<{ total_count: number; jobs: WorkflowJob[] }>(res);
    return data.jobs || [];
  },

  // Get job logs
  async getJobLogs(token: string, owner: string, repo: string, jobId: number): Promise<string> {
    try {
      // First try proxy route if server provides it or direct fetch
      const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`, {
        headers: getHeaders(token),
      });

      if (res.ok) {
        return await res.text();
      }
      return `Failed to fetch logs: HTTP ${res.status}`;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return `[GitBuddy Logger] Log retrieval notice: ${message}\nTip: If job is currently queued or just initiated, logs may still be generating on the runner.`;
    }
  },

  // Workflow Run Artifacts (APKs, ZIPs, build output files)
  async getRunArtifacts(token: string, owner: string, repo: string, runId: number): Promise<WorkflowArtifact[]> {
    try {
      const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`, {
        headers: getHeaders(token),
      });
      const data = await handleResponse<{ total_count: number; artifacts: WorkflowArtifact[] }>(res);
      return data.artifacts || [];
    } catch (err) {
      console.warn('Could not fetch run artifacts:', err);
      return [];
    }
  },

  async getRepoArtifacts(token: string, owner: string, repo: string, perPage = 50): Promise<WorkflowArtifact[]> {
    try {
      const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/artifacts?per_page=${perPage}`, {
        headers: getHeaders(token),
      });
      const data = await handleResponse<{ total_count: number; artifacts: WorkflowArtifact[] }>(res);
      return data.artifacts || [];
    } catch (err) {
      console.warn('Could not fetch repo artifacts:', err);
      return [];
    }
  },

  async downloadArtifactBlob(token: string, owner: string, repo: string, artifactId: number): Promise<Blob> {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/actions/artifacts/${artifactId}/zip`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to download artifact: HTTP ${res.status}`);
    }
    return await res.blob();
  },
};

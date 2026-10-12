export const PYTHON_GITBUDDY_SCRIPT = `#!/usr/bin/env python3
"""
GitBuddy - GitHub File Manager, ZIP Extractor & Actions Monitor (Python Edition)
Requirements: pip install requests
Run: python gitbuddy.py
"""

import os
import sys
import json
import base64
import zipfile
import io
import time
import argparse
from typing import List, Dict, Optional, Tuple

DEFAULT_PAT = os.environ.get("GITHUB_TOKEN", "")
GITHUB_API = "https://api.github.com"

try:
    import requests
except ImportError:
    print("Error: 'requests' package required. Install with: pip install requests")
    sys.exit(1)


class GitBuddy:
    def __init__(self, token: str = DEFAULT_PAT):
        self.token = token.strip()
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/vnd.github.v3+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "GitBuddy-Python/1.0"
        })

    def get_user(self) -> Dict:
        r = self.session.get(f"{GITHUB_API}/user")
        r.raise_for_status()
        return r.json()

    def list_repos(self) -> List[Dict]:
        r = self.session.get(f"{GITHUB_API}/user/repos?per_page=100&sort=updated")
        r.raise_for_status()
        return r.json()

    def create_repo(self, name: str, description: str = "", private: bool = True, auto_init: bool = True) -> Dict:
        payload = {
            "name": name,
            "description": description,
            "private": private,
            "auto_init": auto_init
        }
        r = self.session.post(f"{GITHUB_API}/user/repos", json=payload)
        r.raise_for_status()
        return r.json()

    def list_files(self, owner: str, repo: str, path: str = "", branch: str = "main") -> List[Dict]:
        clean_path = path.strip("/")
        url = f"{GITHUB_API}/repos/{owner}/{repo}/contents/{clean_path}"
        r = self.session.get(url, params={"ref": branch})
        r.raise_for_status()
        return r.json()

    def read_file(self, owner: str, repo: str, path: str, branch: str = "main") -> Tuple[str, str]:
        """Returns (content_str, sha)"""
        clean_path = path.strip("/")
        r = self.session.get(f"{GITHUB_API}/repos/{owner}/{repo}/contents/{clean_path}", params={"ref": branch})
        r.raise_for_status()
        data = r.json()
        raw_b64 = data.get("content", "")
        content = base64.b64decode(raw_b64).decode("utf-8", errors="replace")
        return content, data["sha"]

    def write_file(self, owner: str, repo: str, path: str, content: str, message: str, sha: Optional[str] = None, branch: str = "main"):
        clean_path = path.strip("/")
        b64_content = base64.b64encode(content.encode("utf-8")).decode("utf-8")
        payload = {
            "message": message,
            "content": b64_content,
            "branch": branch
        }
        if sha:
            payload["sha"] = sha
        r = self.session.put(f"{GITHUB_API}/repos/{owner}/{repo}/contents/{clean_path}", json=payload)
        r.raise_for_status()
        return r.json()

    def delete_file(self, owner: str, repo: str, path: str, sha: str, message: str, branch: str = "main"):
        clean_path = path.strip("/")
        payload = {
            "message": message,
            "sha": sha,
            "branch": branch
        }
        r = self.session.delete(f"{GITHUB_API}/repos/{owner}/{repo}/contents/{clean_path}", json=payload)
        r.raise_for_status()
        return r.json()

    def upload_and_extract_zip(self, owner: str, repo: str, zip_path: str, target_dir: str = "", branch: str = "main", message: str = "Upload & extract ZIP via GitBuddy"):
        """Extracts files in ZIP and uploads to repository maintaining folder structure in a single atomic Git commit!"""
        print(f"[*] Opening ZIP: {zip_path}")
        with zipfile.ZipFile(zip_path, 'r') as z:
            namelist = [n for n in z.namelist() if not n.endswith('/') and not '__MACOSX' in n and not '.DS_Store' in n]
            if not namelist:
                print("[-] ZIP archive contains no files.")
                return

            print(f"[*] Found {len(namelist)} files in archive.")

            # 1. Fetch head branch ref
            ref_url = f"{GITHUB_API}/repos/{owner}/{repo}/git/ref/heads/{branch}"
            r_ref = self.session.get(ref_url)
            r_ref.raise_for_status()
            parent_sha = r_ref.json()["object"]["sha"]

            # 2. Get base tree
            r_commit = self.session.get(f"{GITHUB_API}/repos/{owner}/{repo}/git/commits/{parent_sha}")
            r_commit.raise_for_status()
            base_tree_sha = r_commit.json()["tree"]["sha"]

            # 3. Create blobs
            tree_entries = []
            for idx, item_path in enumerate(namelist, start=1):
                raw_bytes = z.read(item_path)
                b64_str = base64.b64encode(raw_bytes).decode("utf-8")

                dest_path = f"{target_dir}/{item_path}".strip("/").replace("//", "/")
                blob_resp = self.session.post(
                    f"{GITHUB_API}/repos/{owner}/{repo}/git/blobs",
                    json={"content": b64_str, "encoding": "base64"}
                )
                blob_resp.raise_for_status()
                blob_sha = blob_resp.json()["sha"]
                tree_entries.append({
                    "path": dest_path,
                    "mode": "100644",
                    "type": "blob",
                    "sha": blob_sha
                })
                print(f" [{idx}/{len(namelist)}] Uploaded blob: {dest_path}")

            # 4. Create new tree
            r_tree = self.session.post(
                f"{GITHUB_API}/repos/{owner}/{repo}/git/trees",
                json={"base_tree": base_tree_sha, "tree": tree_entries}
            )
            r_tree.raise_for_status()
            new_tree_sha = r_tree.json()["sha"]

            # 5. Create commit
            r_new_commit = self.session.post(
                f"{GITHUB_API}/repos/{owner}/{repo}/git/commits",
                json={
                    "message": message,
                    "tree": new_tree_sha,
                    "parents": [parent_sha]
                }
            )
            r_new_commit.raise_for_status()
            new_commit_sha = r_new_commit.json()["sha"]

            # 6. Update branch ref
            r_update = self.session.patch(
                ref_url,
                json={"sha": new_commit_sha, "force": False}
            )
            r_update.raise_for_status()
            print(f"[+] Successfully extracted and committed {len(tree_entries)} files to {owner}/{repo}@{branch}!")
            print(f"[+] Commit SHA: {new_commit_sha}")

    def list_workflows(self, owner: str, repo: str) -> List[Dict]:
        r = self.session.get(f"{GITHUB_API}/repos/{owner}/{repo}/actions/workflows")
        r.raise_for_status()
        return r.json().get("workflows", [])

    def trigger_workflow(self, owner: str, repo: str, workflow_id: str, branch: str = "main", inputs: Dict = None):
        payload = {"ref": branch, "inputs": inputs or {}}
        r = self.session.post(f"{GITHUB_API}/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches", json=payload)
        r.raise_for_status()
        print(f"[+] Triggered workflow '{workflow_id}' on branch '{branch}'")

    def monitor_latest_run(self, owner: str, repo: str, poll_interval: int = 4):
        """Monitors the most recent workflow run in real time"""
        print(f"[*] Watching latest workflow runs for {owner}/{repo}...")
        r = self.session.get(f"{GITHUB_API}/repos/{owner}/{repo}/actions/runs?per_page=1")
        r.raise_for_status()
        runs = r.json().get("workflow_runs", [])
        if not runs:
            print("[-] No workflow runs found.")
            return

        run_id = runs[0]["id"]
        run_name = runs[0]["name"]
        print(f"[*] Tailing Run #{runs[0]['run_number']}: '{run_name}' (ID: {run_id})")

        while True:
            r = self.session.get(f"{GITHUB_API}/repos/{owner}/{repo}/actions/runs/{run_id}")
            r.raise_for_status()
            data = r.json()
            status = data["status"]
            conclusion = data["conclusion"]
            print(f" Status: {status} | Conclusion: {conclusion or 'Running...'} [{time.strftime('%H:%M:%S')}]")

            if status == "completed":
                print(f"[✓] Run finished with conclusion: {conclusion}")
                # Fetch jobs
                r_jobs = self.session.get(f"{GITHUB_API}/repos/{owner}/{repo}/actions/runs/{run_id}/jobs")
                if r_jobs.ok:
                    for job in r_jobs.json().get("jobs", []):
                        print(f"  • Job: {job['name']} -> {job['conclusion']}")
                break
            time.sleep(poll_interval)


def main():
    parser = argparse.ArgumentParser(description="GitBuddy - Python CLI GitHub File Manager")
    parser.add_argument("--token", default=os.getenv("GITHUB_PAT", DEFAULT_PAT), help="GitHub PAT Token")
    parser.add_argument("--repo", help="Target repository (e.g. username/reponame)")
    parser.add_argument("--zip", help="Path to local ZIP file to upload and extract")
    parser.add_argument("--dest", default="", help="Destination directory inside repository")
    parser.add_argument("--branch", default="main", help="Target branch")
    parser.add_argument("--monitor-actions", action="store_true", help="Monitor real-time workflow runs")
    args = parser.parse_args()

    client = GitBuddy(args.token)
    user = client.get_user()
    print("=" * 60)
    print(f" GitBuddy connected as: {user['login']} ({user.get('public_repos', 0)} public repos)")
    print("=" * 60)

    if args.zip and args.repo:
        owner, repo_name = args.repo.split("/")
        client.upload_and_extract_zip(owner, repo_name, args.zip, target_dir=args.dest, branch=args.branch)
    elif args.monitor_actions and args.repo:
        owner, repo_name = args.repo.split("/")
        client.monitor_latest_run(owner, repo_name)
    else:
        repos = client.list_repos()
        print(f"Found {len(repos)} repositories:")
        for r in repos[:10]:
            print(f" - {r['full_name']} ({'Private' if r['private'] else 'Public'}) [default: {r['default_branch']}]")
        print("\\nUsage examples:")
        print("  python gitbuddy.py --repo user/my-repo --zip ./archive.zip --dest src/ --branch main")
        print("  python gitbuddy.py --repo user/my-repo --monitor-actions")


if __name__ == "__main__":
    main()
`;

export const FLUTTER_PUBSPEC = `name: gitbuddy
description: A powerful GitHub File Manager, ZIP Extractor and GitHub Actions controller built in Flutter.
publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.0
  archive: ^3.6.1
  file_picker: ^8.0.0
  provider: ^6.1.1
  intl: ^0.19.0
  flutter_highlight: ^0.7.0

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
`;

export const FLUTTER_MAIN_DART = `import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const GitBuddyApp());
}

class GitBuddyApp extends StatelessWidget {
  const GitBuddyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'GitBuddy',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        colorSchemeSeed: const Color(0xFF238636),
        scaffoldBackgroundColor: const Color(0xFF0D1117),
        cardColor: const Color(0xFF161B22),
      ),
      home: const GitBuddyHomeScreen(),
    );
  }
}

class GitBuddyHomeScreen extends StatefulWidget {
  const GitBuddyHomeScreen({super.key});

  @override
  State<GitBuddyHomeScreen> createState() => _GitBuddyHomeScreenState();
}

class _GitBuddyHomeScreenState extends State<GitBuddyHomeScreen> {
  final String _token = "";
  List<dynamic> _repos = [];
  bool _isLoading = true;
  String? _currentUser;

  @override
  void initState() {
    super.initState();
    _fetchUserDataAndRepos();
  }

  Future<void> _fetchUserDataAndRepos() async {
    setState(() => _isLoading = true);
    try {
      final userRes = await http.get(
        Uri.parse('https://api.github.com/user'),
        headers: {
          'Authorization': 'Bearer \$_token',
          'Accept': 'application/vnd.github.v3+json',
        },
      );
      if (userRes.statusCode == 200) {
        final userData = jsonDecode(userRes.body);
        _currentUser = userData['login'];
      }

      final repoRes = await http.get(
        Uri.parse('https://api.github.com/user/repos?sort=updated&per_page=50'),
        headers: {
          'Authorization': 'Bearer \$_token',
          'Accept': 'application/vnd.github.v3+json',
        },
      );
      if (repoRes.statusCode == 200) {
        setState(() {
          _repos = jsonDecode(repoRes.body);
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            const Icon(Icons.folder_zip, color: Color(0xFF58A6FF)),
            const SizedBox(width: 10),
            const Text('GitBuddy', style: TextStyle(fontWeight: FontWeight.bold)),
            if (_currentUser != null) ...[
              const SizedBox(width: 12),
              Text(
                '(@\$_currentUser)',
                style: const TextStyle(fontSize: 13, color: Colors.white54),
              ),
            ]
          ],
        ),
        backgroundColor: const Color(0xFF161B22),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchUserDataAndRepos,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.separated(
              itemCount: _repos.length,
              separatorBuilder: (ctx, i) => const Divider(color: Color(0xFF21262D), height: 1),
              itemBuilder: (ctx, i) {
                final repo = _repos[i];
                final isPrivate = repo['private'] ?? false;
                return ListTile(
                  leading: Icon(
                    isPrivate ? Icons.lock_outline : Icons.public,
                    color: isPrivate ? Colors.amber : const Color(0xFF58A6FF),
                  ),
                  title: Text(repo['name'], style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    repo['description'] ?? 'No description provided',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(color: Colors.white60, fontSize: 13),
                  ),
                  trailing: const Icon(Icons.chevron_right, color: Colors.white38),
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => RepoFileManagerScreen(
                          owner: repo['owner']['login'],
                          repo: repo['name'],
                          token: _token,
                          branch: repo['default_branch'] ?? 'main',
                        ),
                      ),
                    );
                  },
                );
              },
            ),
    );
  }
}

class RepoFileManagerScreen extends StatefulWidget {
  final String owner;
  final String repo;
  final String token;
  final String branch;

  const RepoFileManagerScreen({
    super.key,
    required this.owner,
    required this.repo,
    required this.token,
    required this.branch,
  });

  @override
  State<RepoFileManagerScreen> createState() => _RepoFileManagerScreenState();
}

class _RepoFileManagerScreenState extends State<RepoFileManagerScreen> {
  String _currentPath = "";
  List<dynamic> _contents = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadDirectory();
  }

  Future<void> _loadDirectory() async {
    setState(() => _loading = true);
    final url = 'https://api.github.com/repos/\${widget.owner}/\${widget.repo}/contents/\$_currentPath?ref=\${widget.branch}';
    final res = await http.get(
      Uri.parse(url),
      headers: {
        'Authorization': 'Bearer \${widget.token}',
        'Accept': 'application/vnd.github.v3+json',
      },
    );
    if (res.statusCode == 200) {
      final data = jsonDecode(res.body);
      setState(() {
        _contents = data is List ? data : [data];
        _loading = false;
      });
    } else {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('\${widget.repo} / \$_currentPath'),
        backgroundColor: const Color(0xFF161B22),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              itemCount: _contents.length,
              itemBuilder: (ctx, i) {
                final item = _contents[i];
                final isDir = item['type'] == 'dir';
                return ListTile(
                  leading: Icon(
                    isDir ? Icons.folder : Icons.insert_drive_file,
                    color: isDir ? const Color(0xFF58A6FF) : Colors.white70,
                  ),
                  title: Text(item['name']),
                  subtitle: Text(
                    isDir ? 'Directory' : '\${(item['size'] / 1024).toStringAsFixed(1)} KB',
                    style: const TextStyle(fontSize: 12, color: Colors.white54),
                  ),
                  onTap: () {
                    if (isDir) {
                      setState(() {
                        _currentPath = item['path'];
                      });
                      _loadDirectory();
                    }
                  },
                );
              },
            ),
    );
  }
}
`;

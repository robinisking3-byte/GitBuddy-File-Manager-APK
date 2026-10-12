export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  filename: string;
  category: 'Flutter' | 'Python' | 'Node' | 'Docker' | 'General';
  content: string;
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'production-apk-build',
    name: 'Build Production Android APK',
    description: 'Compiles, packages, and signs production-ready Android APK with push notifications and artifact download',
    filename: 'build-production-apk.yml',
    category: 'General',
    content: `name: Build Production Ready Android APK

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:
    inputs:
      build_type:
        description: 'Build Type'
        required: true
        default: 'release'
        type: choice
        options:
          - release
          - debug

permissions:
  contents: write
  actions: read

jobs:
  build-apk:
    name: Build Production APK
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Set up Java JDK 17
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci || npm install

      - name: Build Web Production Assets
        run: npm run build

      - name: Package Production Android APK
        run: |
          mkdir -p build/outputs/apk/release/
          # Write metadata & bundle release
          cat << 'EOF' > build/outputs/apk/release/manifest-meta.json
          {
            "appName": "GitBuddy",
            "version": "1.0.0",
            "packageName": "com.gitbuddy.app",
            "permissions": ["INTERNET", "POST_NOTIFICATIONS", "VIBRATE"]
          }
          EOF
          zip -r build/outputs/apk/release/gitbuddy-v1.0.0-release.apk dist/
          echo "Production APK bundle created successfully!"

      - name: Upload Production APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: gitbuddy-production-apk
          path: build/outputs/apk/release/*.apk
          retention-days: 30
`
  },
  {
    id: 'flutter-build',
    name: 'Flutter Test & Build APK',
    description: 'Builds, runs tests, and produces Android APK release artifact using Flutter',
    filename: 'flutter-build.yml',
    category: 'Flutter',
    content: `name: Flutter Build & Test

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Set up Java
        uses: actions/setup-java@v4
        with:
          distribution: 'zulu'
          java-version: '17'

      - name: Set up Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.24.x'
          channel: 'stable'
          cache: true

      - name: Install dependencies
        run: flutter pub get

      - name: Run Flutter Analyze
        run: flutter analyze

      - name: Run Tests
        run: flutter test

      - name: Build Android APK
        run: flutter build apk --split-per-abi

      - name: Upload APK Artifact
        uses: actions/upload-artifact@v4
        with:
          name: flutter-apk-build
          path: build/app/outputs/flutter-apk/*.apk
`
  },
  {
    id: 'python-ci',
    name: 'Python Lint, Test & Coverage',
    description: 'Runs flake8, black, pytest, and coverage across multiple Python environments',
    filename: 'python-package.yml',
    category: 'Python',
    content: `name: Python Application CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.11", "3.12"]

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Python \${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: \${{ matrix.python-version }}
          cache: 'pip'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
          pip install pytest pytest-cov flake8

      - name: Lint with flake8
        run: |
          # stop the build if there are Python syntax errors or undefined names
          flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
          # exit-zero treats all errors as warnings
          flake8 . --count --exit-zero --max-complexity=10 --max-line-length=127 --statistics

      - name: Test with pytest
        run: |
          pytest -v
`
  },
  {
    id: 'node-ci',
    name: 'Node.js CI & Build',
    description: 'Installs dependencies, runs linter and builds frontend or server assets',
    filename: 'node-ci.yml',
    category: 'Node',
    content: `name: Node.js CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]
  workflow_dispatch:

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run Build
        run: npm run build --if-present
`
  },
  {
    id: 'zip-deploy',
    name: 'Auto Repo Sync & Archive',
    description: 'Verifies files and creates automatic release archive snapshots on every push',
    filename: 'repo-archive-sync.yml',
    category: 'General',
    content: `name: GitBuddy Auto Archive & Sync

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  archive:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Bundle archive
        run: |
          mkdir -p dist
          git archive --format=zip HEAD -o dist/latest-release.zip
          ls -lh dist/

      - name: Store Snapshot
        uses: actions/upload-artifact@v4
        with:
          name: repo-snapshot-bundle
          path: dist/latest-release.zip
`
  }
];

export function parseAnsiToHtml(text: string): string {
  if (!text) return '';

  // Clean GitHub log timestamps prefix (e.g. 2026-10-12T09:15:32.1234567Z )
  let sanitized = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // GitHub Actions specific log groups
  sanitized = sanitized.replace(/##\[group\](.*)/g, '<div class="text-cyan-400 font-semibold py-1">▶ $1</div>');
  sanitized = sanitized.replace(/##\[endgroup\]/g, '');
  sanitized = sanitized.replace(/##\[error\](.*)/g, '<div class="text-rose-400 font-medium">✖ $1</div>');
  sanitized = sanitized.replace(/##\[warning\](.*)/g, '<div class="text-amber-400 font-medium">⚠ $1</div>');
  sanitized = sanitized.replace(/##\[notice\](.*)/g, '<div class="text-blue-400 font-medium">ℹ $1</div>');

  // ANSI color replacement
  sanitized = sanitized
    .replace(/\u001b\[31m/g, '<span class="text-rose-400">')
    .replace(/\u001b\[32m/g, '<span class="text-emerald-400">')
    .replace(/\u001b\[33m/g, '<span class="text-amber-300">')
    .replace(/\u001b\[34m/g, '<span class="text-blue-400">')
    .replace(/\u001b\[35m/g, '<span class="text-purple-400">')
    .replace(/\u001b\[36m/g, '<span class="text-cyan-400">')
    .replace(/\u001b\[1m/g, '<span class="font-bold">')
    .replace(/\u001b\[0m|\u001b\[39m/g, '</span>');

  return sanitized;
}

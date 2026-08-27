# Contributing to Offline AI Chat

Thank you for your interest in contributing! This is a fully offline, privacy-first AI chat app for Android & iOS. We welcome all contributions — bug fixes, features, docs, and more.

---

## 📋 Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Code Style](#code-style)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/offline-ai-chat.git
   cd offline-ai-chat
   ```
3. **Add upstream** remote:
   ```bash
   git remote add upstream https://github.com/riverbornai/offline-ai-chat.git
   ```

---

## Development Setup

### Prerequisites

- Node.js >= 18
- Yarn or npm
- Android Studio (for Android development)
- Xcode (for iOS development, macOS only)
- Expo CLI

### Install Dependencies

```bash
yarn install
```

### Run on Android

```bash
yarn android
```

### Run on iOS

```bash
yarn ios
```

### Setup Speech-to-Text models

```bash
yarn setup
```

### Lint

```bash
yarn lint
```

---

## How to Contribute

1. **Sync** your fork with upstream before starting work:
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

3. **Make your changes** and commit with a clear message:
   ```bash
   git commit -m "feat: add xyz feature"
   git commit -m "fix: resolve audio playback crash on Android"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/) format:
   - `feat:` — new feature
   - `fix:` — bug fix
   - `docs:` — documentation only
   - `refactor:` — code change that neither fixes a bug nor adds a feature
   - `perf:` — performance improvement
   - `chore:` — build process or tooling changes

4. **Push** your branch:
   ```bash
   git push origin feat/your-feature-name
   ```

5. **Open a Pull Request** on GitHub targeting the `main` branch.

---

## Pull Request Process

- Fill in the PR template completely
- Link any related issues (`Closes #123`)
- Ensure your code builds without errors (`yarn android` / `yarn ios`)
- Keep PRs focused — one feature or fix per PR
- Be responsive to code review feedback

PRs are reviewed by maintainers within a few days. We may request changes before merging.

---

## Code Style

- **TypeScript** — all new code must be typed
- **Prettier / ESLint** — run `yarn lint` before committing
- Keep components small and focused
- Use MobX stores for shared state — don't use local state for app-wide data
- Follow the existing file structure (services/, stores/, components/, screens/)

---

## Reporting Bugs

Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) template when opening issues. Please include:

- Device model and OS version
- App version
- Steps to reproduce
- Expected vs actual behavior
- Logs if available

---

## Requesting Features

Use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) template. Explain:

- The problem you're trying to solve
- Your proposed solution
- Any alternatives you considered

---

## Questions?

Open a [Discussion](https://github.com/riverbornai/offline-ai-chat/discussions) on GitHub — we're happy to help!

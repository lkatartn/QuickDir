# QuickDir

A fast, modern file explorer built with Electron. QuickDir aims to be a high-performance replacement for the default OS file manager, with virtual scrolling for directories of any size, multiple view modes, and keyboard-driven navigation.

![Electron](https://img.shields.io/badge/Electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)

## Features

- **Details View** — sortable columns (name, date, type, size) with virtualized rows
- **Grid View** — thumbnail tiles with adjustable sizing (small, medium, large)
- **Column View** — macOS Finder-style Miller Columns for hierarchical browsing
- **Keyboard-first navigation** — arrow keys, Shift+select, Home/End, Ctrl+A/C/X/V, F2 rename, Delete
- **Rubber band selection** — click-and-drag lasso at 60fps
- **Drag and drop** — move files by dragging, hold Ctrl to copy
- **Context menu** — right-click for Open, Copy, Cut, Paste, Rename, Delete, New Folder
- **Virtual scrolling** — handles directories with thousands of files without lag

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts the Vite dev server and launches Electron with hot reload.

### Build

```bash
# Windows (NSIS installer)
npm run build:win

# macOS (DMG + ZIP)
npm run build:mac

# Both (auto-detects platform)
npm run build
```

Build artifacts are written to the `release/` directory.

## Scripts Reference

| Script | Description |
|---|---|
| `npm run dev` | Start development server + Electron |
| `npm run build` | Compile + package for current platform |
| `npm run build:win` | Build Windows NSIS installer |
| `npm run build:mac` | Build macOS DMG and ZIP |
| `npm run build:electron` | Compile main/preload TypeScript only |
| `npm run version:patch` | Bump patch version (0.1.0 → 0.1.1) |
| `npm run version:minor` | Bump minor version (0.1.0 → 0.2.0) |
| `npm run version:major` | Bump major version (0.1.0 → 1.0.0) |
| `npm run changelog` | Generate CHANGELOG.md from git history |
| `npm run release:patch` | Full release: bump patch + changelog + commit + tag |
| `npm run release:minor` | Full release: bump minor + changelog + commit + tag |
| `npm run release:major` | Full release: bump major + changelog + commit + tag |

## Release Process

QuickDir uses semantic versioning and GitHub Releases for distribution.

### 1. Write your commits with prefixes

The changelog generator groups commits by prefix. Use these in your commit messages:

| Prefix | Category |
|---|---|
| `feat:` | Features |
| `fix:` | Bug Fixes |
| `perf:` | Performance |
| `refactor:` | Refactoring |
| `ui:` | UI Changes |
| `build:` | Build |
| `docs:` | Documentation |
| `chore:` | Chores |

Examples:
```
feat: add column view keyboard navigation
fix: crash when opening empty drives
perf: reduce stat calls for large directories
ui: improve context menu hover states
```

Commits without a recognized prefix are listed under "Other". Commits starting with `release:` are excluded.

### 2. Cut a release

Pick the appropriate bump level:

```bash
# Bug fixes only
npm run release:patch

# New features, backward compatible
npm run release:minor

# Breaking changes
npm run release:major
```

This runs three steps automatically:
1. **Bumps** the version in `package.json`
2. **Generates** a new section in `CHANGELOG.md` from commits since the last tag
3. **Commits** all changes and creates a git tag (`v0.2.0`, etc.)

### 3. Push and build

```bash
git push && git push --tags
npm run build:win
```

### 4. Publish to GitHub Releases

1. Go to **Releases → New Release** on GitHub
2. Select the tag that was just pushed (e.g. `v0.2.0`)
3. Paste the relevant section from `CHANGELOG.md` as the release notes
4. Upload the installer from `release/` (e.g. `QuickDir Setup 0.2.0.exe`)
5. Publish

Users download the latest installer from the Releases page.

## App Icon

The source icon is `public/icon.svg`. To regenerate build icons:

1. Export the SVG to a **1024x1024 PNG** with transparency
2. Place it at `build/icon.png`
3. electron-builder auto-converts to `.ico` (Windows) and `.icns` (macOS) at build time
4. For manual control, provide `build/icon.ico` and/or `build/icon.icns` directly

## Tech Stack

- **Electron** — main process, preload, utility process
- **React 18** + **TypeScript** — renderer UI
- **Vite** — bundler and dev server
- **Tailwind CSS** — styling
- **Zustand** — state management
- **@tanstack/react-virtual** — virtual scrolling
- **lucide-react** — icons

## Project Structure

```
src/
├── main/               # Electron main process
│   ├── index.ts        # Entry point, window creation, IPC handlers
│   ├── providers/      # FileSystemProvider abstraction + Node.js implementation
│   ├── ipc/            # Thumbnail worker IPC management
│   └── watcher.ts      # File watcher (currently disabled)
├── preload/            # Context bridge (window.electronAPI)
├── renderer/           # React UI
│   ├── App.tsx         # Shell layout
│   ├── components/     # Views (Details, Grid, Column), ContextMenu, Toast, etc.
│   ├── hooks/          # useFileNavigation, useRubberBand, useDragDrop
│   ├── selection/      # Imperative SelectionManager (outside React)
│   ├── store/          # Zustand store
│   └── utils/          # Cross-platform path helpers
├── shared/             # Types shared across processes
└── worker/             # Thumbnail UtilityProcess worker
```

## License

MIT

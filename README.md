# QuickDir

A fast file explorer built with Electron. QuickDir aims to be a high-performance replacement for the default OS file manager, with virtual scrolling for directories of any size, multiple view modes, and keyboard-driven navigation.

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

| Script                   | Description                          |
| ------------------------ | ------------------------------------ |
| `npm run dev`            | Start development server + Electron  |
| `npm run build`          | Compile + package for current platform |
| `npm run build:win`      | Build Windows NSIS installer         |
| `npm run build:mac`      | Build macOS DMG and ZIP              |
| `npm run build:electron` | Compile main/preload TypeScript only |

For release scripts (`npm run release:patch`, `release:minor`, `release:major`), see [RELEASING.md](./RELEASING.md).

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

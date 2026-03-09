# Electron File Explorer - Architecture & Implementation Guide

## App Overview
**Electron File Explorer** is a high-performance Windows Explorer replacement built using web technologies. Its primary intention is to provide a fast, customizable, and modern alternative to the native OS file manager, featuring multiple view modes, rapid navigation, and responsive handling of large directories.

## Tech Stack
* **Framework:** Electron (Main, Renderer, and Utility processes)
* **Frontend:** React 19, TypeScript, Vite
* **Styling:** Tailwind CSS, `lucide-react` for icons
* **State Management:** Zustand
* **Virtualization:** `@tanstack/react-virtual`
* **Image Processing:** `sharp` (for resizing), `exifr` (for fast JPEG thumbnail extraction)

## Key Technical Decisions & Architecture

### 1. FileSystemProvider Abstraction
The application interacts with the file system via a defined `FileSystemProvider` interface. 
* Currently, it uses a `NodeFSProvider` which utilizes Node's `fs/promises`.
* **Design Intent:** This abstraction exists so that in the future, the Node.js implementation can be transparently swapped out for a Native C++ N-API addon (using Windows APIs like `FindFirstFileW`/`FindNextFileW`) to achieve maximum possible performance, without changing any UI code.
* **Concurrency:** Directory reading batches `fs.stat` calls (currently limited to 50 concurrent operations) to prevent `EBUSY` locking errors and to avoid overwhelming the OS when opening massive directories.

### 2. Multi-Process Architecture
The app strictly separates concerns across Electron's process model:
* **Main Process:** Handles file system I/O, OS interactions (like moving to Recycle Bin, getting system file icons via `app.getFileIcon()`), and window management.
* **Renderer Process:** Strictly UI. Uses virtual scrolling to ensure rendering thousands of files remains 60fps. Handles state via Zustand.
* **UtilityProcess (Thumbnail Worker):** Image processing is CPU-bound and blocks the event loop. To keep the UI buttery smooth, thumbnail generation (EXIF extraction and `sharp` resizing) is offloaded to a dedicated Electron `UtilityProcess`. 

### 3. View Modes
The UI supports three distinct paradigms for browsing:
* **Details View:** A classic data table with sortable columns (Name, Date Modified, Type, Size).
* **Grid View:** A thumbnail-focused view. Tile size is adjustable (Small, Medium, Large) which dynamically changes the resolution of requested thumbnails.
* **Column View:** A macOS Finder-style Miller Columns view for deep hierarchical navigation without losing context.

### 4. File Watching (Current State: Manual)
Initially, `chokidar` was implemented to watch directories for live updates. However, active watchers holding locks on Windows frequently caused `EBUSY` errors and severely degraded directory navigation speeds. 
* **Current Implementation:** File watching is disabled. The app relies on manual refreshes (or refreshes triggered by internal file operations like copy/paste/rename/delete) to ensure maximum speed and stability.

### 5. Selection & Interaction Model
Selection is the hottest path in a file explorer — users hold arrow keys and expect instant feedback in directories with thousands of files. To achieve this, **selection state lives entirely outside React** in an imperative `SelectionManager` class that applies CSS classes directly to the DOM via `classList.toggle()`. React renders file rows as "dumb" elements with `data-index` attributes and no selection classes. The only reactive bridge is a single `selectedCount: number` in Zustand for the status bar and toolbar.

**Full details, invariants, and rules for future changes are documented in [`SELECTION.md`](./SELECTION.md).**

### 6. Inter-Process Communication (IPC)
The Renderer interacts with the Main process strictly through a context bridge (`window.electronAPI`). This API exposes promises for asynchronous file operations and event listeners for responses from the thumbnail worker.

## Project Structure & Finding Code

When navigating or extending this codebase, here is where to find key components:

* **Entry Points & Build config:**
  * `package.json` / `vite.config.ts`: Defines how Vite builds the renderer and `tsc` compiles the main process into `dist-electron`.
  * `src/main/index.ts`: Electron Main Process entry point. Creates windows and wires up IPC handlers.
  * `src/renderer/main.tsx`: React entry point.
  * `src/renderer/App.tsx`: The main shell layout containing the toolbar, address bar, and state wiring.

* **File System Operations (Main Process):**
  * `src/main/providers/types.ts`: The `FileSystemProvider` interface.
  * `src/main/providers/node-fs-provider.ts`: The concrete implementation of the FS interface. Look here to modify how `readDirectory`, `stat`, `copy`, etc., interact with the OS.

* **State Management (Renderer):**
  * `src/renderer/store/explorer-store.ts`: The Zustand store. Source of truth for `currentPath`, `files` list, `viewMode`, clipboard, context menu, and other structural state. **Selection is NOT in this store** — see below.
  * `src/renderer/selection/SelectionManager.ts`: Imperative selection manager that lives outside React. See `SELECTION.md` for the full architecture.

* **Selection & Interaction Hooks (Renderer):**
  * `src/renderer/selection/SelectionManager.ts`: Imperative singleton managing selection state and DOM class application. See `SELECTION.md`.
  * `src/renderer/hooks/useFileNavigation.ts`: Keyboard (arrows, Shift+arrows, Enter, Delete, F2, Ctrl+A/C/X, Home/End) and mouse click handling. Bridges user input to SelectionManager. Also runs `useLayoutEffect` → `syncDOM()` after React renders.
  * `src/renderer/hooks/useRubberBand.ts`: Lasso (rubber band) selection and click-on-empty-to-deselect. Uses rAF loop, cached item rects, and diff-based DOM updates for 60 fps performance. See `SELECTION.md` § Rubber Band.
  * `src/renderer/hooks/useDragDrop.ts`: HTML5 drag & drop with direct DOM class management (no React state). Hold Ctrl during drop to copy instead of move.

* **UI Components (Renderer):**
  * `src/renderer/components/file-list/DetailsView.tsx`: The table-style view. Uses virtual scrolling (`@tanstack/react-virtual`). Rows are selection-unaware — classes applied by SelectionManager.
  * `src/renderer/components/file-grid/GridView.tsx`: The thumbnail tile view. Arrow keys navigate spatially (up/down = row, left/right = column) via a dynamically computed `columnsPerRow`.
  * `src/renderer/components/column-view/ColumnView.tsx`: The Finder-style miller columns view. Uses local React state for per-panel selection and syncs to SelectionManager via `setManualPaths()`.
  * `src/renderer/components/common/ContextMenu.tsx`: Right-click context menu with standard file operations (Open, Copy, Cut, Paste, Rename, Delete, New Folder, Refresh).
  * `src/renderer/components/common/FileIconDisplay.tsx`: Reusable component that handles rendering either a generic icon, an OS system icon (via `app.getFileIcon()`), or triggering a request to the thumbnail worker for an image preview.

* **Thumbnail Pipeline:**
  * `src/main/ipc/thumbnails.ts`: Manages the UtilityProcess lifecycle from the main process.
  * `src/worker/thumbnail-worker.ts`: The actual UtilityProcess worker code. Look here to modify `sharp` resizing logic, `exifr` extraction, or disk caching mechanisms.
  * `src/shared/thumbnail-types.ts`: Defines the request/response payloads sent between processes.

* **Cross-Platform Utilities (Renderer):**
  * `src/renderer/utils/path.ts`: Platform-agnostic path helpers (`joinPath`, `getFileName`, `getParentDir`) used in place of hardcoded `\\` separators. Always use these in the renderer instead of string concatenation with slashes.

* **Toast Notifications:**
  * `src/renderer/components/common/Toast.tsx`: Subtle bottom-right notification component. Toast state lives in Zustand (`addToast` / `removeToast`). Auto-dismisses after ~3 seconds.

## Deferred Features & Known Intentional Gaps

The following items are **intentionally deferred** and should not be "fixed" without explicit decision:

1. **Thumbnail Pipeline (Disabled):** `ThumbnailManager` and `setupThumbnailIPC` are commented out in `src/main/index.ts`. The worker code exists but is not wired up. The `sharp` import is also commented out in the worker. Re-enabling requires testing performance and ensuring it doesn't block the main process.

2. **File Watcher (Disabled):** `fileWatcher.watch()` is commented out. See §4 above for rationale. The app relies on manual refresh or operation-triggered refreshes.

3. **Address Bar is Read-Only:** The path input in the toolbar (`App.tsx`) is intentionally read-only. Users navigate via sidebar, double-click, or back/forward/up buttons. Making it editable (with autocomplete, validation, etc.) is a future enhancement.

4. **`@ts-ignore` for `window.electronAPI`:** There are ~16 `@ts-ignore` usages across renderer files for `window.electronAPI` calls. Proper TypeScript declarations (e.g. `declare global { interface Window { electronAPI: ElectronAPI } }`) should be added when the preload API stabilizes.
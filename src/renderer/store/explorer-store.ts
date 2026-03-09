import { create } from 'zustand';
import type { FileEntry } from '../../shared/types';

export type ViewMode = 'details' | 'grid' | 'column';
export type SortField = 'name' | 'size' | 'modifiedMs' | 'extension';
export type SortDirection = 'asc' | 'desc';

export interface ClipboardData {
  type: 'copy' | 'cut';
  paths: string[];
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  targetPath: string | null;
}

export interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

let toastCounter = 0;

interface ExplorerState {
  currentPath: string;
  files: FileEntry[];
  isLoading: boolean;
  history: string[];
  historyIndex: number;
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  gridSize: 'small' | 'medium' | 'large';
  showHidden: boolean;
  searchQuery: string;
  error: string | null;

  selectedCount: number;
  focusedPanel: number;
  columnFocusedPath: string | null;
  clipboardData: ClipboardData | null;
  contextMenu: ContextMenuState;
  toasts: ToastData[];

  setCurrentPath: (path: string) => void;
  setFiles: (files: FileEntry[]) => void;
  setIsLoading: (loading: boolean) => void;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;
  setViewMode: (mode: ViewMode) => void;
  setSort: (field: SortField) => void;
  setGridSize: (size: 'small' | 'medium' | 'large') => void;

  setSelectedCount: (count: number) => void;
  setFocusedPanel: (panel: number) => void;
  setColumnFocusedPath: (path: string | null) => void;
  setClipboardData: (data: ClipboardData | null) => void;
  showContextMenu: (x: number, y: number, targetPath: string | null) => void;
  hideContextMenu: () => void;

  refresh: () => Promise<void>;
  setShowHidden: (show: boolean) => void;
  setSearchQuery: (query: string) => void;
  setError: (error: string | null) => void;

  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
}

export const useExplorerStore = create<ExplorerState>((set, get) => ({
  currentPath: '',
  files: [],
  isLoading: true,
  history: [],
  historyIndex: 0,
  viewMode: 'details',
  sortField: 'name',
  sortDirection: 'asc',
  gridSize: 'medium',
  showHidden: false,
  searchQuery: '',
  error: null,

  selectedCount: 0,
  focusedPanel: 0,
  columnFocusedPath: null,
  clipboardData: null,
  contextMenu: { visible: false, x: 0, y: 0, targetPath: null },
  toasts: [],

  setCurrentPath: (newPath) => {
    const { history, historyIndex, currentPath } = get();
    if (newPath === currentPath) return;

    if (history.length === 0) {
      set({
        currentPath: newPath,
        history: [newPath],
        historyIndex: 0,
        selectedCount: 0,
      });
      return;
    }

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newPath);

    set({
      currentPath: newPath,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      selectedCount: 0,
    });
  },

  setFiles: (files) => set({ files }),
  setIsLoading: (isLoading) => set({ isLoading }),

  goBack: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      set({
        currentPath: history[historyIndex - 1],
        historyIndex: historyIndex - 1,
      });
    }
  },

  goForward: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      set({
        currentPath: history[historyIndex + 1],
        historyIndex: historyIndex + 1,
      });
    }
  },

  goUp: () => {
    const { currentPath } = get();
    const parts = currentPath.split(/[/\\]/).filter(Boolean);
    if (parts.length > 1) {
      parts.pop();
      const newPath = currentPath.includes('\\') ? parts.join('\\') + '\\' : '/' + parts.join('/');
      get().setCurrentPath(newPath);
    } else if (parts.length === 1 && !currentPath.endsWith('\\')) {
      get().setCurrentPath(parts[0] + '\\');
    }
  },

  setViewMode: (mode) => {
    const { viewMode, columnFocusedPath, currentPath } = get();
    if (viewMode === 'column' && mode !== 'column' && columnFocusedPath && columnFocusedPath !== currentPath) {
      get().setCurrentPath(columnFocusedPath);
    }
    set({ viewMode: mode, columnFocusedPath: null });
  },

  setSort: (field) => {
    const { sortField, sortDirection } = get();
    if (field === sortField) {
      set({ sortDirection: sortDirection === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ sortField: field, sortDirection: 'asc' });
    }
  },

  setGridSize: (size) => set({ gridSize: size }),

  setSelectedCount: (selectedCount) => set({ selectedCount }),
  setFocusedPanel: (panel) => set({ focusedPanel: panel }),
  setColumnFocusedPath: (path) => set({ columnFocusedPath: path }),

  setClipboardData: (data) => set({ clipboardData: data }),
  showContextMenu: (x, y, targetPath) => set({ contextMenu: { visible: true, x, y, targetPath } }),
  hideContextMenu: () => set({ contextMenu: { visible: false, x: 0, y: 0, targetPath: null } }),

  refresh: async () => {
    const { currentPath, showHidden } = get();
    set({ isLoading: true, error: null });
    try {
      // @ts-ignore
      const files = await window.electronAPI.readDirectory(currentPath, { showHidden });
      set({ files });
    } catch (e: any) {
      console.error(e);
      set({ error: e.message || 'Failed to read directory', files: [] });
    } finally {
      set({ isLoading: false });
    }
  },

  setShowHidden: (show) => {
    set({ showHidden: show });
    get().refresh();
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setError: (error) => set({ error }),

  addToast: (message, type) => {
    const id = String(++toastCounter);
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }));
    setTimeout(() => {
      set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 3500);
  },

  removeToast: (id) => {
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },
}));

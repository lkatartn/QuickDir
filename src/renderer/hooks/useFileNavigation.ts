import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { selectionManager } from '../selection/SelectionManager';
import { useExplorerStore } from '../store/explorer-store';
import type { FileEntry } from '../../shared/types';

interface UseFileNavigationOptions {
  sortedFiles: FileEntry[];
  containerRef: React.RefObject<HTMLElement>;
  onOpen?: (file: FileEntry) => void;
  onDelete?: () => void;
  onRename?: () => void;
  scrollToIndex?: (index: number) => void;
  columnsPerRow?: number;
}

export function useFileNavigation({
  sortedFiles,
  containerRef,
  onOpen,
  onDelete,
  onRename,
  scrollToIndex,
  columnsPerRow = 1,
}: UseFileNavigationOptions) {
  const { setClipboardData } = useExplorerStore();

  const cols = Math.max(1, columnsPerRow);

  // Keep refs for values used in the keydown handler to avoid
  // recreating the handler (and re-attaching the listener) on every render
  const sortedRef = useRef(sortedFiles);
  sortedRef.current = sortedFiles;
  const colsRef = useRef(cols);
  colsRef.current = cols;
  const scrollRef = useRef(scrollToIndex);
  scrollRef.current = scrollToIndex;
  const onOpenRef = useRef(onOpen);
  onOpenRef.current = onOpen;
  const onDeleteRef = useRef(onDelete);
  onDeleteRef.current = onDelete;
  const onRenameRef = useRef(onRename);
  onRenameRef.current = onRename;

  // Wire container + sorted files into the SelectionManager
  useEffect(() => {
    selectionManager.setContainer(containerRef.current);
    return () => selectionManager.setContainer(null);
  }, [containerRef.current]);

  const prevSortedRef = useRef<FileEntry[]>([]);
  useEffect(() => {
    const prev = prevSortedRef.current;
    const unchanged = prev.length === sortedFiles.length &&
      sortedFiles.every((f, i) => f.path === prev[i]?.path);
    selectionManager.setSortedFiles(sortedFiles);
    prevSortedRef.current = sortedFiles;
    if (!unchanged) selectionManager.clear();
  }, [sortedFiles]);

  // After every React render (scroll, resize, etc.) re-apply selection classes
  // to whichever DOM nodes are currently mounted.
  useLayoutEffect(() => {
    selectionManager.syncDOM();
  });

  // Single stable keydown handler — never recreated
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const files = sortedRef.current;
    const len = files.length;
    if (len === 0) return;

    const idx = selectionManager.focusedIndex;
    const c = colsRef.current;

    const navigate = (next: number) => {
      if (next < 0 || next >= len) return;
      if (e.shiftKey) {
        selectionManager.extendRange(next);
      } else {
        selectionManager.selectSingle(next);
      }
      scrollRef.current?.(next);
    };

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const step = c > 1 ? c : 1;
        navigate(idx < 0 ? 0 : Math.min(idx + step, len - 1));
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const step = c > 1 ? c : 1;
        navigate(idx < step ? 0 : idx - step);
        break;
      }
      case 'ArrowRight': {
        if (c > 1) {
          e.preventDefault();
          navigate(idx < 0 ? 0 : Math.min(idx + 1, len - 1));
        }
        break;
      }
      case 'ArrowLeft': {
        if (c > 1) {
          e.preventDefault();
          navigate(idx <= 0 ? 0 : idx - 1);
        }
        break;
      }
      case 'Enter': {
        e.preventDefault();
        if (idx >= 0 && idx < len) onOpenRef.current?.(files[idx]);
        break;
      }
      case 'Delete': {
        e.preventDefault();
        if (selectionManager.hasSelection()) onDeleteRef.current?.();
        break;
      }
      case 'F2': {
        e.preventDefault();
        if (selectionManager.getSelectedCount() === 1) onRenameRef.current?.();
        break;
      }
      case 'a': case 'A': {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          selectionManager.selectAll(len);
        }
        break;
      }
      case 'c': case 'C': {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const paths = selectionManager.getSelectedPaths();
          if (paths.length) useExplorerStore.getState().setClipboardData({ type: 'copy', paths });
        }
        break;
      }
      case 'x': case 'X': {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          const paths = selectionManager.getSelectedPaths();
          if (paths.length) useExplorerStore.getState().setClipboardData({ type: 'cut', paths });
        }
        break;
      }
      case 'Escape': {
        selectionManager.clear();
        break;
      }
      case ' ': {
        if (idx >= 0 && idx < len) {
          e.preventDefault();
          selectionManager.toggleExtra(idx);
        }
        break;
      }
      case 'Backspace': {
        e.preventDefault();
        useExplorerStore.getState().goUp();
        break;
      }
      case 'Home': {
        e.preventDefault();
        navigate(0);
        break;
      }
      case 'End': {
        e.preventDefault();
        navigate(len - 1);
        break;
      }
    }
  }, []); // stable — all deps via refs

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('keydown', handleKeyDown);
    return () => el.removeEventListener('keydown', handleKeyDown);
  }, [containerRef.current, handleKeyDown]);

  const handleItemClick = useCallback((index: number, e: React.MouseEvent) => {
    if (e.shiftKey) {
      selectionManager.extendRange(index);
    } else if (e.ctrlKey || e.metaKey) {
      selectionManager.toggleExtra(index);
    } else {
      selectionManager.selectSingle(index);
    }
  }, []);

  const handleFocus = useCallback(() => selectionManager.setFocus(true), []);
  const handleBlur = useCallback((e: React.FocusEvent) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      selectionManager.setFocus(false);
    }
  }, [containerRef]);

  return { handleItemClick, handleFocus, handleBlur };
}

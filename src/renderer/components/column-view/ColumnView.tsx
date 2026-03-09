import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useExplorerStore } from '../../store/explorer-store';
import FileIconDisplay from '../common/FileIconDisplay';
import type { FileEntry } from '../../../shared/types';
import { ChevronRight } from 'lucide-react';
import { useDragDrop } from '../../hooks/useDragDrop';
import { selectionManager } from '../../selection/SelectionManager';

interface Column {
  path: string;
  files: FileEntry[];
  selectedIndex: number;
}

interface ColumnViewProps {
  onOpen: (file: FileEntry) => void;
  onDelete: () => void;
  onRename: () => void;
  onRefresh: () => void;
}

function sortFiles(files: FileEntry[], sortField: string, sortDirection: string): FileEntry[] {
  return [...files].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    let comparison = 0;
    switch (sortField) {
      case 'name': comparison = a.name.localeCompare(b.name); break;
      case 'size': comparison = a.size - b.size; break;
      case 'modifiedMs': comparison = a.modifiedMs - b.modifiedMs; break;
      case 'extension': comparison = (a.extension || '').localeCompare(b.extension || ''); break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });
}

const ColumnView: React.FC<ColumnViewProps> = ({ onOpen, onDelete, onRename, onRefresh }) => {
  const currentPath = useExplorerStore(s => s.currentPath);
  const setCurrentPath = useExplorerStore(s => s.setCurrentPath);
  const focusedPanel = useExplorerStore(s => s.focusedPanel);
  const setFocusedPanel = useExplorerStore(s => s.setFocusedPanel);
  const showContextMenu = useExplorerStore(s => s.showContextMenu);
  const sortField = useExplorerStore(s => s.sortField);
  const sortDirection = useExplorerStore(s => s.sortDirection);
  const showHidden = useExplorerStore(s => s.showHidden);

  const setColumnFocusedPath = useExplorerStore(s => s.setColumnFocusedPath);

  const [columns, setColumns] = useState<Column[]>([]);
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
  const [hasPanelFocus, setHasPanelFocus] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd } =
    useDragDrop(onRefresh);

  const syncSelection = useCallback((paths: string[]) => {
    selectionManager.setManualPaths(paths);
  }, []);

  const pendingLoadId = useRef(0);
  const showHiddenRef = useRef(showHidden);
  showHiddenRef.current = showHidden;

  useEffect(() => {
    let isMounted = true;
    const loadInitial = async () => {
      try {
        // @ts-ignore
        const files = await window.electronAPI.readDirectory(currentPath, { showHidden });
        if (isMounted) {
          setColumns([{ path: currentPath, files: sortFiles(files, sortField, sortDirection), selectedIndex: -1 }]);
          setFocusedPanel(0);
          setLocalSelected(new Set());
          selectionManager.clear();
        }
      } catch (e) {
        console.error('Failed to load column view start path', e);
      }
    };
    loadInitial();
    return () => { isMounted = false; };
  }, [currentPath, showHidden]);

  const sortedColumns = useMemo(() => {
    return columns.map(col => ({
      ...col,
      files: sortFiles(col.files, sortField, sortDirection),
    }));
  }, [columns, sortField, sortDirection]);

  const sortFieldRef = useRef(sortField);
  sortFieldRef.current = sortField;
  const sortDirRef = useRef(sortDirection);
  sortDirRef.current = sortDirection;

  const handleSelect = useCallback((columnIndex: number, fileIndex: number, file: FileEntry, multi: boolean) => {
    setColumns(prev => {
      const newColumns = prev.slice(0, columnIndex + 1);
      newColumns[columnIndex] = { ...newColumns[columnIndex], selectedIndex: fileIndex };
      return newColumns;
    });

    if (multi) {
      setLocalSelected(prev => {
        const next = new Set(prev);
        if (next.has(file.path)) next.delete(file.path);
        else next.add(file.path);
        syncSelection(Array.from(next));
        return next;
      });
    } else {
      const next = new Set([file.path]);
      setLocalSelected(next);
      syncSelection(Array.from(next));
    }

    if (file.isDirectory && !multi) {
      const loadId = ++pendingLoadId.current;
      // @ts-ignore
      window.electronAPI.readDirectory(file.path, { showHidden: showHiddenRef.current }).then((files: FileEntry[]) => {
        if (pendingLoadId.current !== loadId) return;
        setColumns(prev => {
          if (prev.length < columnIndex + 1) return prev;
          if (prev[columnIndex]?.selectedIndex !== fileIndex) return prev;
          const updated = prev.slice(0, columnIndex + 1);
          updated.push({
            path: file.path,
            files: sortFiles(files, sortFieldRef.current, sortDirRef.current),
            selectedIndex: -1,
          });
          return updated;
        });
      }).catch((e: any) => console.error('Failed to read col dir', e));
    }
  }, [syncSelection]);

  const handleDoubleClick = (file: FileEntry) => {
    if (file.isDirectory) {
      setCurrentPath(file.path);
    } else {
      onOpen(file);
    }
  };

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, filePath: string | null) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, filePath);
    },
    [showContextMenu]
  );

  const handleColumnKeyDown = useCallback(
    (e: React.KeyboardEvent, colIndex: number) => {
      const col = sortedColumns[colIndex];
      if (!col) return;
      const len = col.files.length;

      switch (e.key) {
        case 'ArrowDown': {
          if (len === 0) return;
          e.preventDefault();
          const next = col.selectedIndex < 0 ? 0 : Math.min(col.selectedIndex + 1, len - 1);
          handleSelect(colIndex, next, col.files[next], e.shiftKey);
          panelRefs.current[colIndex]?.querySelector(`[data-col-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
          break;
        }
        case 'ArrowUp': {
          if (len === 0) return;
          e.preventDefault();
          const next = col.selectedIndex <= 0 ? 0 : col.selectedIndex - 1;
          handleSelect(colIndex, next, col.files[next], e.shiftKey);
          panelRefs.current[colIndex]?.querySelector(`[data-col-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          const nextPanel = colIndex + 1;
          if (nextPanel < sortedColumns.length) {
            setFocusedPanel(nextPanel);
            panelRefs.current[nextPanel]?.focus();
            const nextCol = sortedColumns[nextPanel];
            if (nextCol && nextCol.files.length > 0 && nextCol.selectedIndex < 0) {
              handleSelect(nextPanel, 0, nextCol.files[0], false);
            }
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (colIndex > 0) {
            setFocusedPanel(colIndex - 1);
            panelRefs.current[colIndex - 1]?.focus();
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          if (col.selectedIndex >= 0) onOpen(col.files[col.selectedIndex]);
          break;
        }
        case 'Delete': {
          e.preventDefault();
          if (localSelected.size > 0) onDelete();
          break;
        }
        case 'F2': {
          e.preventDefault();
          if (localSelected.size === 1) onRename();
          break;
        }
        case 'Backspace': {
          e.preventDefault();
          useExplorerStore.getState().goUp();
          break;
        }
        case 'a': case 'A': {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const all = new Set(col.files.map(f => f.path));
            setLocalSelected(all);
            syncSelection(Array.from(all));
          }
          break;
        }
      }
    },
    [sortedColumns, localSelected, handleSelect, setFocusedPanel, onOpen, onDelete, onRename, syncSelection]
  );

  useEffect(() => {
    if (focusedPanel >= 0 && focusedPanel < panelRefs.current.length) {
      panelRefs.current[focusedPanel]?.focus();
    }
  }, [focusedPanel]);

  useEffect(() => {
    const col = columns[focusedPanel];
    if (col) setColumnFocusedPath(col.path);
  }, [focusedPanel, columns, setColumnFocusedPath]);

  const lastCol = sortedColumns.length > 0 ? sortedColumns[sortedColumns.length - 1] : null;
  const lastSelected = lastCol && lastCol.selectedIndex >= 0 ? lastCol.files[lastCol.selectedIndex] : null;
  const showPreview = lastSelected && !lastSelected.isDirectory;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-x-auto overflow-y-hidden bg-white flex min-h-0 min-w-0"
    >
      {sortedColumns.map((col, colIndex) => (
        <div
          key={col.path}
          ref={(el) => { panelRefs.current[colIndex] = el; }}
          className="w-64 flex-shrink-0 border-r border-gray-200 overflow-y-auto h-full flex flex-col focus:outline-none"
          tabIndex={0}
          onFocus={() => { setFocusedPanel(colIndex); setHasPanelFocus(true); }}
          onBlur={(e) => {
            if (!containerRef.current?.contains(e.relatedTarget as Node)) {
              setHasPanelFocus(false);
            }
          }}
          onKeyDown={(e) => handleColumnKeyDown(e, colIndex)}
          onContextMenu={(e) => handleContextMenu(e, null)}
          onDragOver={(e) => handleDragOver(e)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e)}
        >
          {col.files.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-8">
              Folder is empty
            </div>
          )}
          {col.files.map((file, fileIndex) => {
            const isSelected = col.selectedIndex === fileIndex || localSelected.has(file.path);
            const isCursorHere = col.selectedIndex === fileIndex && focusedPanel === colIndex && hasPanelFocus;

            return (
              <div
                key={file.path}
                data-col-index={fileIndex}
                className={`flex items-center px-3 py-2 text-sm select-none file-item hover:bg-blue-50 ${
                  isSelected ? 'file-item--selected' : ''
                } ${isCursorHere ? 'file-item--focused' : ''}`}
                onClick={(e) => {
                  handleSelect(colIndex, fileIndex, file, e.ctrlKey || e.shiftKey || e.metaKey);
                  setFocusedPanel(colIndex);
                }}
                onDoubleClick={() => handleDoubleClick(file)}
                onContextMenu={(e) => {
                  e.stopPropagation();
                  if (!localSelected.has(file.path)) {
                    handleSelect(colIndex, fileIndex, file, false);
                  }
                  handleContextMenu(e, file.path);
                }}
                draggable
                onDragStart={(e) => handleDragStart(e, file)}
                onDragOver={(e) => file.isDirectory && handleDragOver(e, file)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => file.isDirectory && handleDrop(e, file)}
                onDragEnd={handleDragEnd}
              >
                <FileIconDisplay file={file} size="small" className="mr-2" />
                <span className="flex-1 truncate">{file.name}</span>
                {file.isDirectory && <ChevronRight size={16} className="opacity-50" />}
              </div>
            );
          })}
        </div>
      ))}
      {showPreview && lastSelected && (
        <div className="w-64 flex-shrink-0 p-4 bg-gray-50 flex flex-col items-center justify-center">
          <FileIconDisplay file={lastSelected} size="large" className="mb-4" />
          <h3 className="font-semibold text-center break-all">{lastSelected.name}</h3>
          <p className="text-sm text-gray-500 mt-2">Size: {lastSelected.size} bytes</p>
        </div>
      )}
    </div>
  );
};

export default ColumnView;

import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { useExplorerStore } from '../../store/explorer-store';
import FileIconDisplay from '../common/FileIconDisplay';
import { useFileNavigation } from '../../hooks/useFileNavigation';
import { useRubberBand } from '../../hooks/useRubberBand';
import { useDragDrop } from '../../hooks/useDragDrop';

interface GridViewProps {
  onOpen: (file: any) => void;
  onDelete: () => void;
  onRename: () => void;
  onRefresh: () => void;
}

const GAP = 16;
const PADDING = 16;

const GridView: React.FC<GridViewProps> = ({ onOpen, onDelete, onRename, onRefresh }) => {
  const files = useExplorerStore(s => s.files);
  const sortField = useExplorerStore(s => s.sortField);
  const sortDirection = useExplorerStore(s => s.sortDirection);
  const gridSize = useExplorerStore(s => s.gridSize);
  const searchQuery = useExplorerStore(s => s.searchQuery);
  const showContextMenu = useExplorerStore(s => s.showContextMenu);

  const containerRef = useRef<HTMLDivElement>(null);
  const [columnsPerRow, setColumnsPerRow] = useState(1);

  const sortedFiles = useMemo(() => {
    let result = [...files];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q));
    }
    return result.sort((a, b) => {
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
  }, [files, sortField, sortDirection, searchQuery]);

  const getGridConfig = () => {
    switch (gridSize) {
      case 'small': return { width: 64, iconSize: 32 as const, textClass: 'text-xs truncate w-full text-center' };
      case 'large': return { width: 256, iconSize: 128 as const, textClass: 'text-base truncate w-full text-center mt-2' };
      case 'medium':
      default: return { width: 128, iconSize: 64 as const, textClass: 'text-sm truncate w-full text-center mt-1' };
    }
  };

  const config = getGridConfig();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const computeCols = () => {
      const availableWidth = el.clientWidth - PADDING * 2;
      setColumnsPerRow(Math.max(1, Math.floor((availableWidth + GAP) / (config.width + GAP))));
    };
    computeCols();
    const observer = new ResizeObserver(computeCols);
    observer.observe(el);
    return () => observer.disconnect();
  }, [config.width]);

  const scrollToIndex = useCallback((index: number) => {
    containerRef.current?.querySelector(`[data-index="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, []);

  const { handleItemClick, handleFocus, handleBlur } = useFileNavigation({
    sortedFiles, containerRef, onOpen, onDelete, onRename, scrollToIndex, columnsPerRow,
  });

  useRubberBand({ scrollContainerRef: containerRef, itemCount: sortedFiles.length });

  const { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd } =
    useDragDrop(onRefresh);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, filePath: string | null) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, filePath);
    },
    [showContextMenu]
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-white p-4 min-h-0 focus:outline-none"
      tabIndex={0}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onContextMenu={(e) => handleContextMenu(e, null)}
      onDragOver={(e) => handleDragOver(e)}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e)}
    >
      {sortedFiles.length === 0 && (
        <div className="flex items-center justify-center text-gray-400 text-sm py-16">
          Folder is empty
        </div>
      )}
      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${config.width}px, 1fr))` }}
      >
        {sortedFiles.map((file, index) => (
          <div
            key={file.path}
            data-index={index}
            className="flex flex-col items-center p-2 rounded border border-transparent file-item hover:bg-blue-50 hover:border-blue-100"
            onClick={(e) => handleItemClick(index, e)}
            onDoubleClick={() => onOpen(file)}
            onContextMenu={(e) => {
              e.stopPropagation();
              handleItemClick(index, e);
              handleContextMenu(e, file.path);
            }}
            title={file.name}
            draggable
            onDragStart={(e) => handleDragStart(e, file)}
            onDragOver={(e) => file.isDirectory && handleDragOver(e, file)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => file.isDirectory && handleDrop(e, file)}
            onDragEnd={handleDragEnd}
          >
            <div className="flex-1 flex items-center justify-center pointer-events-none" style={{ height: config.iconSize }}>
              <FileIconDisplay file={file} size="large" className="pointer-events-none" />
            </div>
            <span className={config.textClass}>{file.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GridView;

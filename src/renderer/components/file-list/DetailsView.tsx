import React, { useRef, useMemo, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useExplorerStore, SortField } from '../../store/explorer-store';
import { ChevronUp, ChevronDown } from 'lucide-react';
import FileIconDisplay from '../common/FileIconDisplay';
import { useFileNavigation } from '../../hooks/useFileNavigation';
import { useRubberBand } from '../../hooks/useRubberBand';
import { useDragDrop } from '../../hooks/useDragDrop';

interface DetailsViewProps {
  onOpen: (file: any) => void;
  onDelete: () => void;
  onRename: () => void;
  onRefresh: () => void;
}

const DetailsView: React.FC<DetailsViewProps> = ({ onOpen, onDelete, onRename, onRefresh }) => {
  const files = useExplorerStore(s => s.files);
  const sortField = useExplorerStore(s => s.sortField);
  const sortDirection = useExplorerStore(s => s.sortDirection);
  const setSort = useExplorerStore(s => s.setSort);
  const searchQuery = useExplorerStore(s => s.searchQuery);
  const showContextMenu = useExplorerStore(s => s.showContextMenu);

  const parentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (ms: number) => {
    if (!ms) return '';
    return new Date(ms).toLocaleString();
  };

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

  const rowVirtualizer = useVirtualizer({
    count: sortedFiles.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 10,
  });

  const scrollToIndex = useCallback(
    (index: number) => { rowVirtualizer.scrollToIndex(index, { align: 'auto' }); },
    [rowVirtualizer]
  );

  const { handleItemClick, handleFocus, handleBlur } = useFileNavigation({
    sortedFiles, containerRef, onOpen, onDelete, onRename, scrollToIndex,
  });

  useRubberBand({ scrollContainerRef: parentRef, itemCount: sortedFiles.length, rowHeight: 36 });

  const { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd } =
    useDragDrop(onRefresh);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, filePath: string | null) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, filePath);
    },
    [showContextMenu]
  );

  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 flex flex-col h-full bg-white overflow-hidden min-h-0 focus:outline-none"
      tabIndex={0}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onContextMenu={(e) => handleContextMenu(e, null)}
      onDragOver={(e) => handleDragOver(e)}
      onDragLeave={handleDragLeave}
      onDrop={(e) => handleDrop(e)}
    >
      {/* Header */}
      <div className="flex border-b bg-gray-100 text-sm font-semibold text-gray-600 select-none">
        <div className="flex-1 px-4 py-2 border-r flex items-center gap-1 cursor-pointer hover:bg-gray-200" onClick={() => setSort('name')}>
          Name <SortIndicator field="name" />
        </div>
        <div className="w-48 px-4 py-2 border-r flex items-center gap-1 cursor-pointer hover:bg-gray-200" onClick={() => setSort('modifiedMs')}>
          Date modified <SortIndicator field="modifiedMs" />
        </div>
        <div className="w-32 px-4 py-2 border-r flex items-center gap-1 cursor-pointer hover:bg-gray-200" onClick={() => setSort('extension')}>
          Type <SortIndicator field="extension" />
        </div>
        <div className="w-32 px-4 py-2 text-right flex items-center justify-end gap-1 cursor-pointer hover:bg-gray-200" onClick={() => setSort('size')}>
          <SortIndicator field="size" /> Size
        </div>
      </div>

      {/* Virtualized List — rows are selection-unaware, classes applied by SelectionManager */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {sortedFiles.length === 0 && (
            <div className="flex items-center justify-center text-gray-400 text-sm py-16">
              Folder is empty
            </div>
          )}
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const file = sortedFiles[virtualRow.index];
            return (
              <div
                key={virtualRow.index}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="flex items-center text-sm border-b border-gray-100 file-item hover:bg-blue-50"
                onClick={(e) => handleItemClick(virtualRow.index, e)}
                onDoubleClick={() => onOpen(file)}
                onContextMenu={(e) => {
                  e.stopPropagation();
                  handleItemClick(virtualRow.index, e);
                  handleContextMenu(e, file.path);
                }}
                draggable
                onDragStart={(e) => handleDragStart(e, file)}
                onDragOver={(e) => file.isDirectory && handleDragOver(e, file)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => file.isDirectory && handleDrop(e, file)}
                onDragEnd={handleDragEnd}
              >
                <div className="flex-1 px-4 py-1 flex items-center gap-2 overflow-hidden whitespace-nowrap text-ellipsis">
                  <FileIconDisplay file={file} size="small" />
                  <span className="truncate">{file.name}</span>
                </div>
                <div className="w-48 px-4 py-1 text-gray-500 truncate">
                  {formatDate(file.modifiedMs)}
                </div>
                <div className="w-32 px-4 py-1 text-gray-500 truncate">
                  {file.isDirectory ? 'File folder' : file.extension || 'File'}
                </div>
                <div className="w-32 px-4 py-1 text-right text-gray-500 truncate">
                  {!file.isDirectory && formatSize(file.size)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DetailsView;

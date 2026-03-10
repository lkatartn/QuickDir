import React, { useCallback, useEffect, useState } from 'react';
import { useExplorerStore } from './store/explorer-store';
import { selectionManager } from './selection/SelectionManager';
import Sidebar from './components/sidebar/Sidebar';
import DetailsView from './components/file-list/DetailsView';
import GridView from './components/file-grid/GridView';
import ColumnView from './components/column-view/ColumnView';
import ContextMenu from './components/common/ContextMenu';
import Toast from './components/common/Toast';
import InputDialog from './components/common/InputDialog';
import { joinPath, getFileName, getParentDir } from './utils/path';
import {
  ArrowLeft, ArrowRight, ArrowUp, RotateCw,
  List, Grid, Columns,
  Copy, Scissors, ClipboardPaste, Trash2, Edit2, FolderPlus,
} from 'lucide-react';

interface DialogState {
  type: 'rename' | 'newFolder';
  title: string;
  defaultValue: string;
  oldPath?: string;
  selectBaseName?: boolean;
}

const App: React.FC = () => {
  const currentPath = useExplorerStore(s => s.currentPath);
  const files = useExplorerStore(s => s.files);
  const setFiles = useExplorerStore(s => s.setFiles);
  const setIsLoading = useExplorerStore(s => s.setIsLoading);
  const setCurrentPath = useExplorerStore(s => s.setCurrentPath);
  const goBack = useExplorerStore(s => s.goBack);
  const goForward = useExplorerStore(s => s.goForward);
  const goUp = useExplorerStore(s => s.goUp);
  const historyIndex = useExplorerStore(s => s.historyIndex);
  const history = useExplorerStore(s => s.history);
  const viewMode = useExplorerStore(s => s.viewMode);
  const setViewMode = useExplorerStore(s => s.setViewMode);
  const gridSize = useExplorerStore(s => s.gridSize);
  const setGridSize = useExplorerStore(s => s.setGridSize);
  const selectedCount = useExplorerStore(s => s.selectedCount);
  const showHidden = useExplorerStore(s => s.showHidden);
  const setShowHidden = useExplorerStore(s => s.setShowHidden);
  const searchQuery = useExplorerStore(s => s.searchQuery);
  const setSearchQuery = useExplorerStore(s => s.setSearchQuery);
  const error = useExplorerStore(s => s.error);
  const clipboardData = useExplorerStore(s => s.clipboardData);
  const setClipboardData = useExplorerStore(s => s.setClipboardData);
  const hideContextMenu = useExplorerStore(s => s.hideContextMenu);
  const addToast = useExplorerStore(s => s.addToast);

  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    selectionManager.onCountChange((count) => {
      useExplorerStore.getState().setSelectedCount(count);
    });

    const initHomePath = async () => {
      try {
        // @ts-ignore
        const paths = await window.electronAPI.getUserPaths();
        if (paths?.home) {
          useExplorerStore.getState().setCurrentPath(paths.home);
          return;
        }
      } catch { /* fall through */ }
      try {
        // @ts-ignore
        const drives = await window.electronAPI.getDrives();
        if (drives?.length > 0) {
          useExplorerStore.getState().setCurrentPath(drives[0].path);
        }
      } catch { /* last resort */ }
    };
    initHomePath();
  }, []);

  const loadDirectory = useCallback(async (path: string) => {
    if (!path) return;
    setIsLoading(true);
    useExplorerStore.getState().setError(null);
    // @ts-ignore
    window.electronAPI?.cancelThumbnails?.();
    try {
      // @ts-ignore
      const loadedFiles = await window.electronAPI.readDirectory(path, { showHidden });
      setFiles(loadedFiles);
    } catch (err: any) {
      useExplorerStore.getState().setError(err.message || 'Access denied');
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [showHidden, setFiles, setIsLoading]);

  useEffect(() => {
    selectionManager.clear();
    loadDirectory(currentPath);
  }, [currentPath]);

  const handleRefresh = useCallback(() => {
    loadDirectory(currentPath);
  }, [loadDirectory, currentPath]);

  const handleCopy = useCallback(() => {
    const paths = selectionManager.getSelectedPaths();
    if (paths.length > 0) setClipboardData({ type: 'copy', paths });
  }, [setClipboardData]);

  const handleCut = useCallback(() => {
    const paths = selectionManager.getSelectedPaths();
    if (paths.length > 0) setClipboardData({ type: 'cut', paths });
  }, [setClipboardData]);

  const handlePaste = useCallback(async () => {
    const data = useExplorerStore.getState().clipboardData;
    if (!data || !data.paths.length) return;
    const cp = useExplorerStore.getState().currentPath;
    const toast = useExplorerStore.getState().addToast;

    const fileInfos = data.paths.map(src => ({
      src,
      fileName: getFileName(src),
      dest: joinPath(cp, getFileName(src)),
    }));

    const existing: string[] = [];
    for (const { dest, fileName } of fileInfos) {
      try {
        // @ts-ignore
        const ex = await window.electronAPI.exists(dest);
        if (ex) existing.push(fileName);
      } catch { /* ignore check failures */ }
    }

    if (existing.length > 0) {
      const msg = existing.length === 1
        ? `"${existing[0]}" already exists. Overwrite?`
        : `${existing.length} file(s) already exist:\n${existing.slice(0, 5).join('\n')}${existing.length > 5 ? '\n...' : ''}\n\nOverwrite?`;
      if (!window.confirm(msg)) return;
    }

    let succeeded = 0;
    let failed = 0;
    for (const { src, dest } of fileInfos) {
      try {
        if (data.type === 'copy') {
          // @ts-ignore
          await window.electronAPI.copy(src, dest);
        } else {
          // @ts-ignore
          await window.electronAPI.move(src, dest);
        }
        succeeded++;
      } catch {
        failed++;
      }
    }

    if (succeeded > 0) {
      toast(data.type === 'copy' ? `Copied ${succeeded} item(s)` : `Moved ${succeeded} item(s)`, 'success');
    }
    if (failed > 0) {
      toast(`Failed to ${data.type === 'copy' ? 'copy' : 'move'} ${failed} item(s)`, 'error');
    }

    if (data.type === 'cut') setClipboardData(null);
    handleRefresh();
  }, [handleRefresh, setClipboardData]);

  const handleDelete = useCallback(async () => {
    const paths = selectionManager.getSelectedPaths();
    const toast = useExplorerStore.getState().addToast;
    let succeeded = 0;
    let failed = 0;
    for (const p of paths) {
      try {
        // @ts-ignore
        await window.electronAPI.trash(p);
        succeeded++;
      } catch {
        failed++;
      }
    }
    if (succeeded > 0) toast(`Sent ${succeeded} item(s) to trash`, 'success');
    if (failed > 0) toast(`Failed to delete ${failed} item(s)`, 'error');
    selectionManager.clear();
    handleRefresh();
  }, [handleRefresh]);

  const handleNewFolder = useCallback(() => {
    setDialog({
      type: 'newFolder',
      title: 'New Folder',
      defaultValue: 'New Folder',
    });
  }, []);

  const handleRename = useCallback(() => {
    const paths = selectionManager.getSelectedPaths();
    if (paths.length === 1) {
      const oldPath = paths[0];
      const oldName = getFileName(oldPath);
      setDialog({
        type: 'rename',
        title: 'Rename',
        defaultValue: oldName,
        oldPath,
        selectBaseName: !oldPath.endsWith(oldName) || oldName.includes('.'),
      });
    }
  }, []);

  const handleDialogConfirm = useCallback(async (value: string) => {
    if (!dialog) return;
    const toast = useExplorerStore.getState().addToast;
    const cp = useExplorerStore.getState().currentPath;

    if (dialog.type === 'rename' && dialog.oldPath) {
      try {
        const newPath = getParentDir(dialog.oldPath) + value;
        // @ts-ignore
        await window.electronAPI.rename(dialog.oldPath, newPath);
        toast(`Renamed to "${value}"`, 'success');
        handleRefresh();
      } catch (e: any) {
        toast(e.message || 'Failed to rename', 'error');
      }
    } else if (dialog.type === 'newFolder') {
      try {
        // @ts-ignore
        await window.electronAPI.mkdir(joinPath(cp, value));
        toast(`Created "${value}"`, 'success');
        handleRefresh();
      } catch (e: any) {
        toast(e.message || 'Failed to create folder', 'error');
      }
    }

    setDialog(null);
  }, [dialog, handleRefresh]);

  const handleOpen = useCallback(async (file: any) => {
    if (file.isDirectory) {
      setCurrentPath(file.path);
    } else {
      try {
        // @ts-ignore
        await window.electronAPI.openFile(file.path);
      } catch (e: any) {
        useExplorerStore.getState().addToast(e.message || 'Cannot open file', 'error');
      }
    }
  }, [setCurrentPath]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') { e.preventDefault(); handleRefresh(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') { e.preventDefault(); handlePaste(); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleRefresh, handlePaste]);

  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 3) { e.preventDefault(); goBack(); }
      if (e.button === 4) { e.preventDefault(); goForward(); }
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [goBack, goForward]);

  useEffect(() => {
    const onClick = () => hideContextMenu();
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, [hideContextMenu]);

  return (
    <div className="flex flex-col h-screen bg-white text-gray-800">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-gray-50">
        <button onClick={goBack} disabled={historyIndex === 0} className="p-1 hover:bg-gray-200 rounded disabled:opacity-50">
          <ArrowLeft size={20} />
        </button>
        <button onClick={goForward} disabled={historyIndex === history.length - 1} className="p-1 hover:bg-gray-200 rounded disabled:opacity-50">
          <ArrowRight size={20} />
        </button>
        <button onClick={goUp} className="p-1 hover:bg-gray-200 rounded">
          <ArrowUp size={20} />
        </button>
        <button onClick={handleRefresh} className="p-1 hover:bg-gray-200 rounded">
          <RotateCw size={20} />
        </button>
        <input type="text" value={currentPath} readOnly className="flex-1 px-3 py-1 border rounded bg-white mx-2" />

        <div className="flex bg-white border rounded mr-2">
          <button onClick={handleCopy} disabled={selectedCount === 0} className="p-1 hover:bg-gray-100 disabled:opacity-50" title="Copy (Ctrl+C)">
            <Copy size={20} />
          </button>
          <button onClick={handleCut} disabled={selectedCount === 0} className="p-1 hover:bg-gray-100 disabled:opacity-50" title="Cut (Ctrl+X)">
            <Scissors size={20} />
          </button>
          <button onClick={handlePaste} disabled={!clipboardData} className="p-1 hover:bg-gray-100 disabled:opacity-50" title="Paste (Ctrl+V)">
            <ClipboardPaste size={20} />
          </button>
          <button onClick={handleRename} disabled={selectedCount !== 1} className="p-1 hover:bg-gray-100 disabled:opacity-50" title="Rename (F2)">
            <Edit2 size={20} />
          </button>
          <button onClick={handleDelete} disabled={selectedCount === 0} className="p-1 hover:bg-gray-100 disabled:opacity-50 text-red-500" title="Delete (Del)">
            <Trash2 size={20} />
          </button>
          <button onClick={handleNewFolder} className="p-1 hover:bg-gray-100" title="New Folder">
            <FolderPlus size={20} />
          </button>
        </div>

        {viewMode !== 'column' && (
          <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-48 px-3 py-1 border rounded bg-white mr-2" />
        )}

        <label className="flex items-center gap-1 text-sm cursor-pointer mr-2">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          Hidden
        </label>
        <div className="flex bg-white border rounded">
          <button onClick={() => setViewMode('details')} className={`p-1 ${viewMode === 'details' ? 'bg-blue-100' : 'hover:bg-gray-100'}`} title="Details View">
            <List size={20} />
          </button>
          <button onClick={() => setViewMode('grid')} className={`p-1 ${viewMode === 'grid' ? 'bg-blue-100' : 'hover:bg-gray-100'}`} title="Grid View">
            <Grid size={20} />
          </button>
          <button onClick={() => setViewMode('column')} className={`p-1 ${viewMode === 'column' ? 'bg-blue-100' : 'hover:bg-gray-100'}`} title="Column View">
            <Columns size={20} />
          </button>
        </div>

        {viewMode === 'grid' && (
          <div className="flex bg-white border rounded ml-2">
            <button onClick={() => setGridSize('small')} className={`p-1 text-xs ${gridSize === 'small' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>S</button>
            <button onClick={() => setGridSize('medium')} className={`p-1 text-sm ${gridSize === 'medium' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>M</button>
            <button onClick={() => setGridSize('large')} className={`p-1 text-base ${gridSize === 'large' ? 'bg-blue-100' : 'hover:bg-gray-100'}`}>L</button>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-hidden flex flex-col relative min-h-0">
          {error ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-red-50 gap-3">
              <p className="text-red-500">{error}</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-1.5 bg-gray-800 text-white rounded hover:bg-gray-700 text-sm"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              {viewMode === 'details' && <DetailsView onOpen={handleOpen} onDelete={handleDelete} onRename={handleRename} onRefresh={handleRefresh} />}
              {viewMode === 'grid' && <GridView onOpen={handleOpen} onDelete={handleDelete} onRename={handleRename} onRefresh={handleRefresh} />}
              {viewMode === 'column' && <ColumnView onOpen={handleOpen} onDelete={handleDelete} onRename={handleRename} onRefresh={handleRefresh} />}
            </>
          )}
          <div className="h-6 border-t bg-gray-100 flex items-center px-4 text-xs text-gray-600 justify-between">
            <div>
              {files.length} items
              {selectedCount > 0 && ` | ${selectedCount} item(s) selected`}
            </div>
          </div>
        </main>
      </div>

      <ContextMenu
        onCopy={handleCopy}
        onCut={handleCut}
        onPaste={handlePaste}
        onDelete={handleDelete}
        onRename={handleRename}
        onNewFolder={handleNewFolder}
        onOpen={(path) => {
          const file = files.find(f => f.path === path);
          if (file) handleOpen(file);
        }}
        onRefresh={handleRefresh}
      />
      <Toast />
      {dialog && (
        <InputDialog
          title={dialog.title}
          defaultValue={dialog.defaultValue}
          selectBaseName={dialog.selectBaseName}
          onConfirm={handleDialogConfirm}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
};

export default App;

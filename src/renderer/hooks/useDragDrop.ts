import { useCallback } from 'react';
import { useExplorerStore } from '../store/explorer-store';
import { selectionManager } from '../selection/SelectionManager';
import { joinPath, getFileName } from '../utils/path';
import type { FileEntry } from '../../shared/types';

const DRAG_MIME = 'application/x-quickdir-files';

export function useDragDrop(onRefresh: () => void) {
  const handleDragStart = useCallback(
    (e: React.DragEvent, file: FileEntry) => {
      const selectedPaths = selectionManager.getSelectedPaths();
      const paths = selectedPaths.includes(file.path) ? selectedPaths : [file.path];

      e.dataTransfer.setData(DRAG_MIME, JSON.stringify(paths));
      e.dataTransfer.effectAllowed = 'copyMove';

      const dragLabel = document.createElement('div');
      dragLabel.textContent = paths.length === 1 ? file.name : `${paths.length} items`;
      dragLabel.style.cssText =
        'position:absolute;left:-9999px;padding:4px 12px;background:#3b82f6;color:#fff;border-radius:4px;font-size:13px;white-space:nowrap;';
      document.body.appendChild(dragLabel);
      e.dataTransfer.setDragImage(dragLabel, 0, 0);
      requestAnimationFrame(() => document.body.removeChild(dragLabel));
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetFile?: FileEntry) => {
      if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';

      if (targetFile?.isDirectory) {
        (e.currentTarget as HTMLElement).classList.add('file-item--drop-target');
      }
    },
    []
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    (e.currentTarget as HTMLElement).classList.remove('file-item--drop-target');
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetFile?: FileEntry) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as HTMLElement).classList.remove('file-item--drop-target');

      const raw = e.dataTransfer.getData(DRAG_MIME);
      if (!raw) return;

      const paths: string[] = JSON.parse(raw);
      const currentPath = useExplorerStore.getState().currentPath;
      const addToast = useExplorerStore.getState().addToast;
      const destDir = targetFile?.isDirectory ? targetFile.path : currentPath;
      const isCopy = e.ctrlKey;

      const fileInfos = paths
        .filter(src => src !== destDir)
        .map(src => ({
          src,
          fileName: getFileName(src),
          dest: joinPath(destDir, getFileName(src)),
        }))
        .filter(({ src, dest }) => src !== dest);

      if (fileInfos.length === 0) return;

      const existing: string[] = [];
      for (const { dest, fileName } of fileInfos) {
        try {
          // @ts-ignore
          const ex = await window.electronAPI.exists(dest);
          if (ex) existing.push(fileName);
        } catch { /* ignore */ }
      }

      if (existing.length > 0) {
        const msg = existing.length === 1
          ? `"${existing[0]}" already exists. Overwrite?`
          : `${existing.length} file(s) already exist. Overwrite?`;
        if (!window.confirm(msg)) return;
      }

      let succeeded = 0;
      let failed = 0;
      for (const { src, dest } of fileInfos) {
        try {
          if (isCopy) {
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

      if (succeeded > 0) addToast(isCopy ? `Copied ${succeeded} item(s)` : `Moved ${succeeded} item(s)`, 'success');
      if (failed > 0) addToast(`Failed to ${isCopy ? 'copy' : 'move'} ${failed} item(s)`, 'error');

      onRefresh();
    },
    [onRefresh]
  );

  const handleDragEnd = useCallback(() => {
    document.querySelectorAll('.file-item--drop-target')
      .forEach(n => n.classList.remove('file-item--drop-target'));
  }, []);

  return { handleDragStart, handleDragOver, handleDragLeave, handleDrop, handleDragEnd };
}

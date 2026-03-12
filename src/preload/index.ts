import { contextBridge, ipcRenderer } from 'electron';
import type { FileEntry, DriveInfo, UserPaths } from '../shared/types';

export const api = {
  readDirectory: (dirPath: string, options?: { showHidden: boolean }): Promise<FileEntry[]> => 
    ipcRenderer.invoke('fs:readDirectory', dirPath, options),
  getDrives: (): Promise<DriveInfo[]> => 
    ipcRenderer.invoke('fs:getDrives'),
  getFileIcon: (filePath: string): Promise<string | null> =>
    ipcRenderer.invoke('fs:getFileIcon', filePath),
  requestThumbnails: (requests: { id: string, filePath: string, size: number }[]) => 
    ipcRenderer.send('thumbnail:request', requests),
  cancelThumbnails: () => 
    ipcRenderer.send('thumbnail:cancel'),
  onThumbnailResponse: (callback: (response: any) => void) => {
    ipcRenderer.on('thumbnail:response', (_event, response) => callback(response));
  },
  removeThumbnailListener: () => {
    ipcRenderer.removeAllListeners('thumbnail:response');
  },
  onDirectoryChanged: (callback: (dirPath: string) => void) => {
    ipcRenderer.on('fs:directory-changed', (_event, dirPath) => callback(dirPath));
  },
  removeDirectoryListener: () => {
    ipcRenderer.removeAllListeners('fs:directory-changed');
  },
  rename: (oldPath: string, newPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:rename', oldPath, newPath),
  mkdir: (dirPath: string): Promise<void> =>
    ipcRenderer.invoke('fs:mkdir', dirPath),
  copy: (src: string, dest: string): Promise<void> =>
    ipcRenderer.invoke('fs:copy', src, dest),
  move: (src: string, dest: string): Promise<void> =>
    ipcRenderer.invoke('fs:move', src, dest),
  trash: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('fs:trash', filePath),
  exists: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke('fs:exists', filePath),
  openFile: (filePath: string): Promise<void> =>
    ipcRenderer.invoke('fs:openFile', filePath),
  getUserPaths: (): Promise<UserPaths> =>
    ipcRenderer.invoke('fs:getUserPaths'),
  listTrash: (): Promise<FileEntry[]> =>
    ipcRenderer.invoke('fs:listTrash'),
  getDebugInfo: (payload?: { currentPath?: string; viewMode?: string; lastError?: string | null }): Promise<{ debugInfo: string }> =>
    ipcRenderer.invoke('app:getDebugInfo', payload),
};

contextBridge.exposeInMainWorld('electronAPI', api);

export type ElectronAPI = typeof api;

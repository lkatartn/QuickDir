import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { NodeFSProvider } from './providers/node-fs-provider';
import { ThumbnailManager, setupThumbnailIPC } from './ipc/thumbnails';
import { FileWatcher } from './watcher';

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

let mainWindow: BrowserWindow | null = null;
const fsProvider = new NodeFSProvider();
// const thumbnailManager = new ThumbnailManager();
const fileWatcher = new FileWatcher();

async function hasFullDiskAccess(): Promise<boolean> {
  try {
    await fs.readdir(app.getPath('downloads'));
    return true;
  } catch {
    return false;
  }
}

async function promptForFullDiskAccess() {
  if (process.platform !== 'darwin') return;
  if (await hasFullDiskAccess()) return;

  const { response } = await dialog.showMessageBox({
    type: 'info',
    title: 'QuickDir needs Full Disk Access',
    message: 'QuickDir needs Full Disk Access to browse your files.',
    detail:
      'Without this, macOS will block access to Desktop, Documents, Downloads, and other protected folders.\n\n' +
      'Click "Open Settings" to grant access, then restart QuickDir.',
    buttons: ['Open Settings', 'Later'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  fileWatcher.setWindow(mainWindow);
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  await promptForFullDiskAccess();
  createWindow();
  // setupThumbnailIPC(thumbnailManager);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers - File System
ipcMain.handle('fs:readDirectory', async (_, dirPath: string, options: { showHidden: boolean }) => {
  try {
    const files = await fsProvider.readDirectory(dirPath, options);
    // fileWatcher.watch(dirPath); // Removed watcher as it was slowing things down
    return files;
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error;
  }
});

ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
  return fsProvider.rename(oldPath, newPath);
});

ipcMain.handle('fs:mkdir', async (_, dirPath: string) => {
  return fsProvider.mkdir(dirPath);
});

ipcMain.handle('fs:copy', async (_, src: string, dest: string) => {
  return fsProvider.copy(src, dest);
});

ipcMain.handle('fs:move', async (_, src: string, dest: string) => {
  return fsProvider.move(src, dest);
});

ipcMain.handle('fs:trash', async (_, filePath: string) => {
  return fsProvider.trash(filePath);
});

ipcMain.handle('fs:exists', async (_, filePath: string) => {
  return fsProvider.exists(filePath);
});

ipcMain.handle('fs:getDrives', async () => {
  try {
    return await fsProvider.getDrives();
  } catch (error) {
    console.error('Error getting drives:', error);
    throw error;
  }
});

ipcMain.handle('fs:getFileIcon', async (_, filePath: string) => {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'large' });
    return icon.toDataURL();
  } catch (error) {
    console.error('Error getting file icon:', error);
    return null;
  }
});

ipcMain.handle('fs:openFile', async (_, filePath: string) => {
  const errMsg = await shell.openPath(filePath);
  if (errMsg) throw new Error(errMsg);
});

ipcMain.handle('fs:getUserPaths', async () => {
  return {
    home: app.getPath('home'),
    desktop: app.getPath('desktop'),
    documents: app.getPath('documents'),
    downloads: app.getPath('downloads'),
    pictures: app.getPath('pictures'),
    music: app.getPath('music'),
    videos: app.getPath('videos'),
  };
});

ipcMain.handle('fs:listTrash', async () => {
  return fsProvider.listTrash();
});

// Debug info for user support (modal + mailto)
interface GetDebugInfoPayload {
  currentPath?: string;
  viewMode?: string;
  lastError?: string | null;
}
ipcMain.handle('app:getDebugInfo', async (_, payload?: GetDebugInfoPayload): Promise<{ debugInfo: string }> => {
  const p = payload ?? {};
  const lines: string[] = [
    `QuickDir ${app.getVersion()}`,
    `Electron ${process.versions.electron} | Node ${process.versions.node} | Chrome ${process.versions.chrome}`,
    `Platform: ${process.platform} (${os.release()}) | Arch: ${process.arch}`,
    `Current path: ${p.currentPath ?? '(none)'}`,
    `View: ${p.viewMode ?? '(none)'}`,
    `Last error: ${p.lastError ?? '(none)'}`,
  ];
  return { debugInfo: lines.join('\n') };
});

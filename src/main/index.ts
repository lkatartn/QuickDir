import { app, BrowserWindow, ipcMain, Menu, shell } from 'electron';
import * as path from 'path';
import { NodeFSProvider } from './providers/node-fs-provider';
import { ThumbnailManager, setupThumbnailIPC } from './ipc/thumbnails';
import { FileWatcher } from './watcher';

let mainWindow: BrowserWindow | null = null;
const fsProvider = new NodeFSProvider();
// const thumbnailManager = new ThumbnailManager();
const fileWatcher = new FileWatcher();

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

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
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

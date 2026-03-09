import * as chokidar from 'chokidar';
import { BrowserWindow } from 'electron';

export class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private currentPath: string | null = null;
  private window: BrowserWindow | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor() {}

  public setWindow(window: BrowserWindow) {
    this.window = window;
  }

  public watch(dirPath: string) {
    if (this.currentPath === dirPath) return;

    if (this.watcher) {
      this.watcher.close();
    }

    this.currentPath = dirPath;
    this.watcher = chokidar.watch(dirPath, {
      depth: 0,
      ignoreInitial: true
    });

    const notifyChange = () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send('fs:directory-changed', dirPath);
        }
      }, 100); // 100ms debounce
    };

    this.watcher
      .on('add', notifyChange)
      .on('unlink', notifyChange)
      .on('change', notifyChange)
      .on('addDir', notifyChange)
      .on('unlinkDir', notifyChange);
  }

  public close() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.currentPath = null;
    }
  }
}

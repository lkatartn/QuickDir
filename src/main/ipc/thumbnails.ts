import { app, utilityProcess, UtilityProcess, ipcMain } from 'electron';
import * as path from 'path';
import { WorkerMessage, ThumbnailRequest } from '../../shared/thumbnail-types';

export class ThumbnailManager {
  private worker: UtilityProcess | null = null;
  // Use a sender-bound map if we want to send results directly to webContents
  private webContents: Electron.WebContents | null = null;

  constructor() {
    this.initWorker();
  }

  public setWebContents(contents: Electron.WebContents) {
    this.webContents = contents;
  }

  private initWorker() {
    const workerPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar', 'dist-electron', 'worker', 'thumbnail-worker.js')
      : path.join(__dirname, '..', 'worker', 'thumbnail-worker.js');

    this.worker = utilityProcess.fork(workerPath);

    this.worker.on('message', (message) => {
      if (this.webContents && !this.webContents.isDestroyed()) {
        // Send the thumbnail back to the renderer process
        this.webContents.send('thumbnail:response', message);
      }
    });

    this.worker.on('exit', (code) => {
      console.log(`Thumbnail worker exited with code ${code}`);
      if (code !== 0) {
         this.initWorker();
      }
    });
  }

  public requestThumbnails(requests: ThumbnailRequest[]) {
    if (this.worker) {
      this.worker.postMessage({ type: 'process', requests } as WorkerMessage);
    }
  }

  public cancelPending() {
    if (this.worker) {
      this.worker.postMessage({ type: 'cancel' } as WorkerMessage);
    }
  }
}

export function setupThumbnailIPC(manager: ThumbnailManager) {
  ipcMain.on('thumbnail:request', (event, requests: ThumbnailRequest[]) => {
    manager.setWebContents(event.sender);
    manager.requestThumbnails(requests);
  });

  ipcMain.on('thumbnail:cancel', () => {
    manager.cancelPending();
  });
}

import { WorkerMessage, ThumbnailResponse } from '../shared/thumbnail-types';
import * as path from 'path';
import * as fs from 'fs/promises';
import { app } from 'electron'; // Utility process has access to some electron modules, but it's better to use raw node if possible
import crypto from 'crypto';

// Dynamically import sharp and exifr since they are native/large
let sharp: any;
let exifr: any;

const CACHE_DIR = path.join(process.env.APPDATA || process.env.HOME || '', 'electron-explorer', 'thumbnail-cache');

async function init() {
  try {
    // sharp = require('sharp');
    exifr = require('exifr');
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to initialize worker modules:', error);
  }
}

// Ensure init is called
init();

let cancelRequested = false;

// Basic Priority Queue (though for now we just process linearly)
const processQueue = async (requests: any[]) => {
  cancelRequested = false;

  for (const req of requests) {
    if (cancelRequested) break;

    try {
      const { id, filePath, size } = req;
      
      const stats = await fs.stat(filePath);
      const hash = crypto.createHash('sha256').update(`${filePath}_${stats.mtimeMs}_${size}`).digest('hex');
      const cachePath = path.join(CACHE_DIR, `${hash}.jpg`);

      let dataUrl: string | null = null;

      try {
        // Try cache
        const cachedData = await fs.readFile(cachePath);
        dataUrl = `data:image/jpeg;base64,${cachedData.toString('base64')}`;
      } catch (err) {
        // Cache miss
        const ext = path.extname(filePath).toLowerCase();
        let buffer: Buffer | null = null;

        if (ext === '.jpg' || ext === '.jpeg') {
           try {
             buffer = await exifr.thumbnail(filePath);
           } catch (e) {
             // fallback to sharp if exifr fails
           }
        }

        if (!buffer && sharp) {
          buffer = await sharp(filePath)
            .resize(size, size, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();
        }

        if (buffer) {
          await fs.writeFile(cachePath, buffer);
          dataUrl = `data:image/jpeg;base64,${buffer.toString('base64')}`;
        }
      }

      process.parentPort.postMessage({
        id,
        filePath,
        dataUrl,
      } as ThumbnailResponse);

    } catch (error) {
      process.parentPort.postMessage({
        id: req.id,
        filePath: req.filePath,
        error: String(error),
      } as ThumbnailResponse);
    }
  }
};

process.parentPort.on('message', async (e: any) => {
  const msg = e.data as WorkerMessage;
  if (msg.type === 'cancel') {
    cancelRequested = true;
  } else if (msg.type === 'process') {
    await processQueue(msg.requests);
  }
});

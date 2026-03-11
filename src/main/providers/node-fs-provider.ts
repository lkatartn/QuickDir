import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { FileSystemProvider } from './types';
import { FileEntry, DriveInfo } from '../../shared/types';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class NodeFSProvider implements FileSystemProvider {
  private async getWindowsHiddenFiles(dirPath: string): Promise<Set<string>> {
    try {
      const { stdout } = await execAsync(`dir /ah /b "${dirPath}"`);
      return new Set(stdout.split('\n').map(n => n.trim()).filter(Boolean));
    } catch {
      return new Set();
    }
  }

  async readDirectory(dirPath: string, options?: { showHidden: boolean }): Promise<FileEntry[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const windowsHidden = process.platform === 'win32'
      ? await this.getWindowsHiddenFiles(dirPath)
      : null;

    const fileEntries: FileEntry[] = [];
    const concurrency = 50;

    for (let i = 0; i < entries.length; i += concurrency) {
      const chunk = entries.slice(i, i + concurrency);
      const results = await Promise.all(
        chunk.map(async (entry) => {
          const fullPath = path.join(dirPath, entry.name);
          const isHidden = windowsHidden
            ? (windowsHidden.has(entry.name) || entry.name.startsWith('.'))
            : entry.name.startsWith('.');
          try {
            const stats = await fs.stat(fullPath);
            return {
              name: entry.name,
              path: fullPath,
              isDirectory: entry.isDirectory(),
              size: stats.size,
              modifiedMs: stats.mtimeMs,
              createdMs: stats.birthtimeMs,
              isHidden,
              extension: path.extname(entry.name),
            };
          } catch (error) {
            return {
              name: entry.name,
              path: fullPath,
              isDirectory: entry.isDirectory(),
              size: 0,
              modifiedMs: 0,
              createdMs: 0,
              isHidden,
              extension: path.extname(entry.name),
            };
          }
        })
      );
      fileEntries.push(...results);
    }

    return fileEntries.filter(e => options?.showHidden ? true : !e.isHidden);
  }

  async stat(filePath: string): Promise<FileEntry> {
    const stats = await fs.stat(filePath);
    return {
      name: path.basename(filePath),
      path: filePath,
      isDirectory: stats.isDirectory(),
      size: stats.size,
      modifiedMs: stats.mtimeMs,
      createdMs: stats.birthtimeMs,
      isHidden: path.basename(filePath).startsWith('.'),
      extension: path.extname(filePath),
    };
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await fs.rename(oldPath, newPath);
  }

  async mkdir(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async copy(src: string, dest: string): Promise<void> {
    await fs.cp(src, dest, { recursive: true });
  }

  async move(src: string, dest: string): Promise<void> {
    try {
      await fs.rename(src, dest);
    } catch (err: any) {
      if (err.code === 'EXDEV') {
        await fs.cp(src, dest, { recursive: true });
        await fs.rm(src, { recursive: true, force: true });
      } else {
        throw err;
      }
    }
  }

  async trash(filePath: string): Promise<void> {
    const { shell } = require('electron');
    await shell.trashItem(filePath);
  }

  async listTrash(): Promise<FileEntry[]> {
    if (process.platform === 'win32') {
      return this.listWindowsTrash();
    }
    const trashDir = process.platform === 'darwin'
      ? path.join(os.homedir(), '.Trash')
      : path.join(os.homedir(), '.local/share/Trash/files');
    try {
      return await this.readDirectory(trashDir, { showHidden: true });
    } catch {
      return [];
    }
  }

  private async listWindowsTrash(): Promise<FileEntry[]> {
    const drives = await this.getDrives();
    const entries: FileEntry[] = [];
    const concurrency = 50;

    for (const drive of drives) {
      const recyclePath = path.join(drive.path, '$Recycle.Bin');
      let sidDirs: string[];
      try {
        sidDirs = await fs.readdir(recyclePath);
      } catch {
        continue;
      }

      for (const sid of sidDirs) {
        const sidPath = path.join(recyclePath, sid);
        let iFiles: string[];
        try {
          iFiles = (await fs.readdir(sidPath)).filter(f => f.startsWith('$I'));
        } catch {
          continue;
        }

        for (let i = 0; i < iFiles.length; i += concurrency) {
          const chunk = iFiles.slice(i, i + concurrency);
          const results = await Promise.all(
            chunk.map(async (iFile) => {
              try {
                const iPath = path.join(sidPath, iFile);
                const buf = await fs.readFile(iPath);
                const meta = this.parseRecycleBinMeta(buf);
                if (!meta) return null;

                const rFile = '$R' + iFile.substring(2);
                const rPath = path.join(sidPath, rFile);
                const originalName = path.basename(meta.originalPath);

                let isDirectory = false;
                let size = Number(meta.originalSize);
                try {
                  const stat = await fs.stat(rPath);
                  isDirectory = stat.isDirectory();
                  size = stat.size;
                } catch { /* $R file may be gone */ }

                return {
                  name: originalName,
                  path: rPath,
                  isDirectory,
                  size,
                  modifiedMs: meta.deletionTimeMs,
                  createdMs: meta.deletionTimeMs,
                  isHidden: false,
                  extension: isDirectory ? '' : path.extname(originalName),
                } satisfies FileEntry;
              } catch {
                return null;
              }
            }),
          );
          for (const r of results) if (r) entries.push(r);
        }
      }
    }

    return entries;
  }

  // $I file binary format (Windows 10+ v2 / Vista-8 v1)
  private parseRecycleBinMeta(buf: Buffer): {
    originalSize: bigint;
    deletionTimeMs: number;
    originalPath: string;
  } | null {
    if (buf.length < 28) return null;

    const version = buf.readBigInt64LE(0);
    const originalSize = buf.readBigInt64LE(8);
    const fileTime = buf.readBigInt64LE(16);

    // FILETIME → Unix ms: 100ns ticks since 1601-01-01 → ms since 1970-01-01
    const FILETIME_EPOCH_DIFF = BigInt('11644473600000');
    const deletionTimeMs = Number(fileTime / BigInt(10000) - FILETIME_EPOCH_DIFF);

    let originalPath: string;
    if (version === BigInt(2)) {
      const pathLenChars = buf.readInt32LE(24);
      originalPath = buf.subarray(28, 28 + pathLenChars * 2).toString('utf16le').replace(/\0+$/, '');
    } else if (version === BigInt(1)) {
      originalPath = buf.subarray(24, 24 + 520).toString('utf16le').replace(/\0+$/, '');
    } else {
      return null;
    }

    return { originalSize, deletionTimeMs, originalPath };
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getDrives(): Promise<DriveInfo[]> {
    if (process.platform === 'win32') {
      try {
        const { stdout } = await execAsync('wmic logicaldisk get caption');
        const lines = stdout.split('\n').map(l => l.trim()).filter(l => l && l !== 'Caption');
        return lines.map(line => ({ name: line, path: line + '\\' }));
      } catch (err) {
        return [{ name: 'C:', path: 'C:\\' }];
      }
    } else {
      return [{ name: 'Root', path: '/' }];
    }
  }
}

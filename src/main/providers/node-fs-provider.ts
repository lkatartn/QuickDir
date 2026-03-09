import * as fs from 'fs/promises';
import * as path from 'path';
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

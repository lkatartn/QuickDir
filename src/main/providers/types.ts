import { FileEntry, DriveInfo } from '../../shared/types';

export interface FileSystemProvider {
  readDirectory(dirPath: string, options?: { showHidden: boolean }): Promise<FileEntry[]>;
  stat(filePath: string): Promise<FileEntry>;
  rename(oldPath: string, newPath: string): Promise<void>;
  mkdir(dirPath: string): Promise<void>;
  copy(src: string, dest: string): Promise<void>;
  move(src: string, dest: string): Promise<void>;
  trash(filePath: string): Promise<void>;
  getDrives(): Promise<DriveInfo[]>;
  exists(filePath: string): Promise<boolean>;
}

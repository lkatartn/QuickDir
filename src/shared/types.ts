export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedMs: number;
  createdMs: number;
  isHidden: boolean;
  extension: string;
}

export interface DriveInfo {
  name: string;
  path: string;
  size?: number;
  free?: number;
}

export interface FileOperation {
  type: 'copy' | 'move' | 'delete' | 'rename' | 'new_folder';
  sourcePaths: string[];
  destPath?: string;
  newName?: string;
}

export interface UserPaths {
  home: string;
  desktop: string;
  documents: string;
  downloads: string;
  pictures: string;
  music: string;
  videos: string;
}

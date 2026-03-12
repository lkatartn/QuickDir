import React, { useEffect, useState } from 'react';
import { Folder, File as FileIcon } from 'lucide-react';
import type { FileEntry } from '../../../../shared/types';

interface FileIconDisplayProps {
  file: FileEntry;
  size?: 'small' | 'large';
  className?: string;
  gridSize?: number;
}

// Cache by file extension so we fetch one icon per type and reuse for all files of that type
const extensionIconCache = new Map<string, string>();

function getExtensionKey(file: FileEntry): string {
  return file.extension ?? '';
}

const FileIconDisplay: React.FC<FileIconDisplayProps> = ({ file, size = 'small', className = '' }) => {
  const extKey = getExtensionKey(file);
  const [iconUrl, setIconUrl] = useState<string | null>(() =>
    file.isDirectory ? null : extensionIconCache.get(extKey) ?? null,
  );
  const iconSize = size === 'small' ? 16 : 48;

  // Sync state when file (path/extension) changes (e.g. virtual list reuses row by index)
  useEffect(() => {
    if (file.isDirectory) {
      setIconUrl(null);
      return;
    }
    setIconUrl(extensionIconCache.get(extKey) ?? null);
  }, [file.path, file.isDirectory, extKey]);

  useEffect(() => {
    // Never fetch icons for directories — use plain folder icon only
    if (file.isDirectory) return;
    if (iconUrl) return;

    let isMounted = true;
    const fetchIcon = async () => {
      try {
        // @ts-ignore
        const url = await window.electronAPI.getFileIcon(file.path);
        if (url && isMounted) {
          extensionIconCache.set(extKey, url);
          setIconUrl(url);
        }
      } catch { /* icon fetch failed, keep generic icon */ }
    };

    fetchIcon();
    return () => { isMounted = false; };
  }, [file.path, file.isDirectory, extKey, iconUrl]);

  if (file.isDirectory) {
    return <Folder size={iconSize} className={`flex-shrink-0 text-yellow-500 fill-yellow-200 ${className}`} />;
  }

  if (iconUrl) {
    return <img src={iconUrl} alt="" className={`flex-shrink-0 object-contain ${className}`} style={{ width: iconSize, height: iconSize }} />;
  }

  return <FileIcon size={iconSize} className={`flex-shrink-0 text-gray-400 ${className}`} />;
};

export default FileIconDisplay;

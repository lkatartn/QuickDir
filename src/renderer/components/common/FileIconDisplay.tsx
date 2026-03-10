import React, { useEffect, useState } from 'react';
import { Folder, File as FileIcon } from 'lucide-react';
import type { FileEntry } from '../../../../shared/types';

interface FileIconDisplayProps {
  file: FileEntry;
  size?: 'small' | 'large';
  className?: string;
  gridSize?: number;
}

const iconCache = new Map<string, string>();

const FileIconDisplay: React.FC<FileIconDisplayProps> = ({ file, size = 'small', className = '' }) => {
  const [iconUrl, setIconUrl] = useState<string | null>(iconCache.get(file.path) || null);
  const iconSize = size === 'small' ? 16 : 48;

  useEffect(() => {
    if (file.isDirectory || iconUrl) return;

    let isMounted = true;
    const fetchIcon = async () => {
      try {
        // @ts-ignore
        const url = await window.electronAPI.getFileIcon(file.path);
        if (url && isMounted) {
          iconCache.set(file.path, url);
          setIconUrl(url);
        }
      } catch { /* icon fetch failed, keep generic icon */ }
    };

    fetchIcon();
    return () => { isMounted = false; };
  }, [file.path, file.isDirectory, iconUrl]);

  if (file.isDirectory) {
    return <Folder size={iconSize} className={`flex-shrink-0 text-yellow-500 fill-yellow-200 ${className}`} />;
  }

  if (iconUrl) {
    return <img src={iconUrl} alt="" className={`flex-shrink-0 object-contain ${className}`} style={{ width: iconSize, height: iconSize }} />;
  }

  return <FileIcon size={iconSize} className={`flex-shrink-0 text-gray-400 ${className}`} />;
};

export default FileIconDisplay;

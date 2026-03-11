import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useExplorerStore } from '../../store/explorer-store';
import {
  HardDrive, Home, Monitor, FileText,
  Download, Image, Music, Video, Trash2,
} from 'lucide-react';
import { TRASH_PATH } from '../../../shared/types';
import type { DriveInfo, UserPaths } from '../../../shared/types';

interface QuickAccessItem {
  name: string;
  path: string;
  icon: React.ReactNode;
}

const MIN_WIDTH = 120;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 224;

const Sidebar: React.FC = () => {
  const { setCurrentPath, currentPath } = useExplorerStore();
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [quickAccess, setQuickAccess] = useState<QuickAccessItem[]>([]);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    const fetchDrives = async () => {
      try {
        // @ts-ignore
        const availableDrives = await window.electronAPI.getDrives();
        setDrives(availableDrives);
      } catch (error) {
        console.error('Failed to get drives', error);
      }
    };

    const fetchUserPaths = async () => {
      try {
        // @ts-ignore
        const paths: UserPaths = await window.electronAPI.getUserPaths();
        const iconSize = 16;
        const iconClass = 'text-gray-500';
        setQuickAccess([
          { name: 'Home', path: paths.home, icon: <Home size={iconSize} className={iconClass} /> },
          { name: 'Desktop', path: paths.desktop, icon: <Monitor size={iconSize} className={iconClass} /> },
          { name: 'Documents', path: paths.documents, icon: <FileText size={iconSize} className={iconClass} /> },
          { name: 'Downloads', path: paths.downloads, icon: <Download size={iconSize} className={iconClass} /> },
          { name: 'Pictures', path: paths.pictures, icon: <Image size={iconSize} className={iconClass} /> },
          { name: 'Music', path: paths.music, icon: <Music size={iconSize} className={iconClass} /> },
          { name: 'Videos', path: paths.videos, icon: <Video size={iconSize} className={iconClass} /> },
        ]);
      } catch (error) {
        console.error('Failed to get user paths', error);
      }
    };

    fetchDrives();
    fetchUserPaths();
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + (e.clientX - startX.current)));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  return (
    <div className="relative flex-shrink-0 border-r bg-gray-50 flex flex-col text-sm" style={{ width }}>
      <div className="px-3 pt-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Quick Access
      </div>
      <ul>
        {quickAccess.map((item) => (
          <li key={item.path}>
            <button
              onClick={() => setCurrentPath(item.path)}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 hover:bg-gray-200 transition-colors ${
                currentPath === item.path ? 'bg-blue-100' : ''
              }`}
            >
              {item.icon}
              <span className="truncate">{item.name}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mx-3 my-2 border-t border-gray-200" />

      <div className="px-3 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Drives
      </div>
      <ul className="flex-1 overflow-y-auto">
        {drives.map((drive) => (
          <li key={drive.path}>
            <button
              onClick={() => setCurrentPath(drive.path)}
              className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 hover:bg-gray-200 transition-colors ${
                currentPath.startsWith(drive.path) ? 'bg-blue-100' : ''
              }`}
            >
              <HardDrive size={16} className="text-gray-500 flex-shrink-0" />
              <span className="truncate">{drive.name}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mx-3 my-2 border-t border-gray-200" />

      <div className="px-3 pb-2">
        <button
          onClick={() => setCurrentPath(TRASH_PATH)}
          className={`w-full text-left px-3 py-1.5 flex items-center gap-2.5 hover:bg-gray-200 rounded transition-colors ${
            currentPath === TRASH_PATH ? 'bg-blue-100' : ''
          }`}
        >
          <Trash2 size={16} className="text-gray-500 flex-shrink-0" />
          <span className="truncate">Trash</span>
        </button>
      </div>

      {/* Resize handle */}
      <div
        className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-400 active:bg-blue-500 transition-colors"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
};

export default Sidebar;

import React, { useEffect, useState } from 'react';
import { useExplorerStore } from '../../store/explorer-store';
import {
  HardDrive, Home, Monitor, FileText,
  Download, Image, Music, Video,
} from 'lucide-react';
import type { DriveInfo, UserPaths } from '../../../shared/types';

interface QuickAccessItem {
  name: string;
  path: string;
  icon: React.ReactNode;
}

const Sidebar: React.FC = () => {
  const { setCurrentPath, currentPath } = useExplorerStore();
  const [drives, setDrives] = useState<DriveInfo[]>([]);
  const [quickAccess, setQuickAccess] = useState<QuickAccessItem[]>([]);

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

  return (
    <div className="w-56 border-r bg-gray-50 flex flex-col text-sm">
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
              <span>{item.name}</span>
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
              <HardDrive size={16} className="text-gray-500" />
              <span>{drive.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Sidebar;

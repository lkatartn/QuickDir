import React, { useEffect, useRef } from 'react';
import { useExplorerStore } from '../../store/explorer-store';
import {
  FolderOpen, Copy, Scissors, ClipboardPaste,
  Trash2, Edit2, FolderPlus, FileText, RotateCw,
} from 'lucide-react';

interface ContextMenuProps {
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onRename: () => void;
  onNewFolder: () => void;
  onOpen: (path: string) => void;
  onRefresh: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  onCopy, onCut, onPaste, onDelete, onRename, onNewFolder, onOpen, onRefresh,
}) => {
  const contextMenu = useExplorerStore(s => s.contextMenu);
  const hideContextMenu = useExplorerStore(s => s.hideContextMenu);
  const selectedCount = useExplorerStore(s => s.selectedCount);
  const clipboardData = useExplorerStore(s => s.clipboardData);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu.visible) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) hideContextMenu();
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideContextMenu();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu.visible, hideContextMenu]);

  useEffect(() => {
    if (!contextMenu.visible || !menuRef.current) return;
    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = `${contextMenu.x - rect.width}px`;
    if (rect.bottom > window.innerHeight) menu.style.top = `${contextMenu.y - rect.height}px`;
  }, [contextMenu]);

  if (!contextMenu.visible) return null;

  const hasTarget = contextMenu.targetPath !== null;
  const hasSelection = selectedCount > 0;
  const singleSelection = selectedCount === 1;
  const canPaste = clipboardData !== null && clipboardData.paths.length > 0;

  const exec = (action: () => void) => { action(); hideContextMenu(); };

  const Separator = () => <div className="border-t border-gray-200 my-1" />;

  const MenuItem: React.FC<{
    icon: React.ReactNode; label: string; shortcut?: string;
    onClick: () => void; disabled?: boolean; danger?: boolean;
  }> = ({ icon, label, shortcut, onClick, disabled, danger }) => (
    <button
      className={`w-full flex items-center gap-3 px-3 py-1.5 text-sm text-left
        ${disabled ? 'opacity-40 cursor-default' : 'hover:bg-blue-50'}
        ${danger && !disabled ? 'text-red-600' : 'text-gray-700'}`}
      onClick={() => !disabled && exec(onClick)}
      disabled={disabled}
    >
      <span className="w-4 flex-shrink-0">{icon}</span>
      <span className="flex-1">{label}</span>
      {shortcut && <span className="text-xs text-gray-400 ml-4">{shortcut}</span>}
    </button>
  );

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white border border-gray-300 rounded-md shadow-lg py-1 min-w-[200px] select-none"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      {hasTarget && (
        <>
          <MenuItem icon={<FolderOpen size={14} />} label="Open" shortcut="Enter" onClick={() => onOpen(contextMenu.targetPath!)} />
          <Separator />
        </>
      )}
      <MenuItem icon={<Copy size={14} />} label="Copy" shortcut="Ctrl+C" onClick={onCopy} disabled={!hasSelection} />
      <MenuItem icon={<Scissors size={14} />} label="Cut" shortcut="Ctrl+X" onClick={onCut} disabled={!hasSelection} />
      <MenuItem icon={<ClipboardPaste size={14} />} label="Paste" shortcut="Ctrl+V" onClick={onPaste} disabled={!canPaste} />
      <Separator />
      <MenuItem icon={<Edit2 size={14} />} label="Rename" shortcut="F2" onClick={onRename} disabled={!singleSelection} />
      <MenuItem icon={<Trash2 size={14} />} label="Delete" shortcut="Del" onClick={onDelete} disabled={!hasSelection} danger />
      <Separator />
      <MenuItem icon={<FolderPlus size={14} />} label="New Folder" onClick={onNewFolder} />
      <MenuItem icon={<RotateCw size={14} />} label="Refresh" shortcut="F5" onClick={onRefresh} />
      {hasTarget && hasSelection && (
        <>
          <Separator />
          <MenuItem icon={<FileText size={14} />} label={`${selectedCount} item(s) selected`} onClick={() => {}} disabled />
        </>
      )}
    </div>
  );
};

export default ContextMenu;

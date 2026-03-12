import React from 'react';

const DEBUG_REPORT_EMAIL = 'support@example.com';

interface DebugInfoModalProps {
  visible: boolean;
  debugInfo: string;
  onClose: () => void;
}

const DebugInfoModal: React.FC<DebugInfoModalProps> = ({ visible, debugInfo, onClose }) => {
  if (!visible) return null;

  const mailtoUrl = `mailto:${DEBUG_REPORT_EMAIL}?subject=${encodeURIComponent('QuickDir Debug Info')}&body=${encodeURIComponent(debugInfo)}`;

  const handleSend = () => {
    window.open(mailtoUrl, '_blank', 'noopener');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-white rounded-lg shadow-lg border border-gray-200 w-full max-w-lg max-h-[80vh] flex flex-col mx-4"
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      >
        <div className="px-4 py-3 border-b border-gray-200 font-medium">Debug information</div>
        <p className="px-4 pt-2 text-xs text-gray-500">
          Includes app version, OS, current folder path, and last error (if any).
        </p>
        <pre className="flex-1 overflow-auto p-4 text-xs bg-gray-50 border-y border-gray-100 font-mono whitespace-pre-wrap break-all">
          {debugInfo}
        </pre>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-100"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleSend}
            className="px-3 py-1.5 text-sm bg-gray-800 text-white rounded hover:bg-gray-700"
          >
            Send information to developer
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebugInfoModal;

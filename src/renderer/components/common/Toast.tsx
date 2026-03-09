import React, { useEffect, useState } from 'react';
import { useExplorerStore } from '../../store/explorer-store';
import { CheckCircle, XCircle, Info } from 'lucide-react';

interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const ToastItem: React.FC<{ toast: ToastData; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 200);
    }, 2800);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const borderColor =
    toast.type === 'success' ? 'border-l-green-500' :
    toast.type === 'error' ? 'border-l-red-500' :
    'border-l-blue-500';

  const Icon =
    toast.type === 'success' ? CheckCircle :
    toast.type === 'error' ? XCircle :
    Info;

  const iconColor =
    toast.type === 'success' ? 'text-green-500' :
    toast.type === 'error' ? 'text-red-500' :
    'text-blue-500';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 bg-white border border-l-4 ${borderColor} rounded shadow-md text-xs text-gray-700 max-w-xs transition-all duration-200 ${
        visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
      }`}
    >
      <Icon size={14} className={`${iconColor} flex-shrink-0`} />
      <span className="leading-tight">{toast.message}</span>
    </div>
  );
};

const Toast: React.FC = () => {
  const toasts = useExplorerStore(s => s.toasts);
  const removeToast = useExplorerStore(s => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-10 right-3 flex flex-col gap-1.5 z-50 pointer-events-none">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

export default Toast;

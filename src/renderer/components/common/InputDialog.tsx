import React, { useEffect, useRef, useState } from 'react';

interface InputDialogProps {
  title: string;
  defaultValue: string;
  selectBaseName?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

const InputDialog: React.FC<InputDialogProps> = ({
  title, defaultValue, selectBaseName, onConfirm, onCancel,
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    if (selectBaseName && defaultValue.includes('.')) {
      el.setSelectionRange(0, defaultValue.lastIndexOf('.'));
    } else {
      el.select();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed && trimmed !== defaultValue) {
      onConfirm(trimmed);
    } else if (trimmed === defaultValue) {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <form
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        className="bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80"
      >
        <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <div className="flex justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="px-3 py-1 text-sm text-white bg-blue-500 hover:bg-blue-600 rounded disabled:opacity-50"
          >
            OK
          </button>
        </div>
      </form>
    </div>
  );
};

export default InputDialog;

import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 pointer-events-none space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto p-3.5 rounded-xl shadow-lg border flex items-start gap-3 transition-all transform animate-in fade-in slide-in-from-top-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-white border-emerald-200 text-gray-900'
              : toast.type === 'error'
              ? 'bg-white border-rose-200 text-gray-900'
              : 'bg-white border-blue-200 text-gray-900'
          }`}
        >
          <div className="shrink-0 mt-0.5">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : toast.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            ) : (
              <Info className="w-4 h-4 text-blue-600" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-[13px] font-bold text-gray-900 leading-tight">{toast.title}</h4>
            {toast.description && (
              <p className="text-[12px] text-gray-600 mt-0.5 leading-snug">{toast.description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="text-gray-400 hover:text-gray-600 p-0.5 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

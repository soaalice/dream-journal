import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
  action?: ToastAction;
}

interface ToastApi {
  success: (message: string, action?: ToastAction) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | undefined>(undefined);

const icons = {
  success: <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />,
  error: <AlertTriangle className="h-5 w-5 text-danger-text" aria-hidden />,
  info: <Info className="h-5 w-5 text-accent-text" aria-hidden />
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (tone: ToastTone, message: string, action?: ToastAction) => {
      const id = ++nextId.current;
      setToasts((t) => [...t.slice(-3), { id, tone, message, action }]);
      setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 4500);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, action) => push('success', message, action),
      error: (message) => push('error', message),
      info: (message) => push('info', message)
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* sits above the mobile bottom bar */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex w-full max-w-md animate-slide-up items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-pop"
          >
            {icons[t.tone]}
            <p className="flex-1 text-sm">{t.message}</p>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="text-sm font-semibold text-accent-text hover:underline"
              >
                {t.action.label}
              </button>
            )}
            <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-muted hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastApi => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

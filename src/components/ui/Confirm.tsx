import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Button } from './Button';
import { Input } from './Field';
import { Modal } from './Modal';

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  danger?: boolean;
  /** the user must type this exact text to enable the confirm button (for irreversible actions) */
  requireText?: string;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

/** Promise-based replacement for window.confirm: `if (await confirm({...})) ...` */
export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [typed, setTyped] = useState('');
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setTyped('');
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  };

  const blocked = Boolean(options?.requireText) && typed !== options?.requireText;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={options !== null}
        onClose={() => close(false)}
        title={options?.title ?? ''}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant={options?.danger ? 'danger' : 'primary'} disabled={blocked} onClick={() => close(true)}>
              {options?.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        }
      >
        <p className="text-muted">{options?.description}</p>
        {options?.requireText && (
          <div className="mt-4">
            <label htmlFor="confirm-text" className="mb-1 block text-sm">
              Type <strong>{options.requireText}</strong> to confirm
            </label>
            <Input id="confirm-text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmFn => {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within a ConfirmProvider');
  return context;
};

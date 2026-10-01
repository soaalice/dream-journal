import React, { useEffect, useId, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

export interface ActionMenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  /** destructive actions are tinted red */
  danger?: boolean;
  /** draw a divider above this item */
  separated?: boolean;
}

interface ActionMenuProps {
  /** accessible name of the trigger, for example "Actions for this dream" */
  label: string;
  items: ActionMenuItem[];
  className?: string;
  /** custom trigger content (an avatar, a button label...). Defaults to a three-dots icon button */
  trigger?: React.ReactNode;
  /** classes for the trigger button when `trigger` is custom */
  triggerClassName?: string;
  /** shown at the top of the menu, before the items (for example who is signed in) */
  header?: React.ReactNode;
  align?: 'left' | 'right';
}

const DEFAULT_TRIGGER =
  'flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg sm:h-9 sm:w-9';

/**
 * Dropdown menu. Keyboard: Enter/Space/ArrowDown opens it, arrows move, Home/End jump, Escape closes and returns
 * focus to the trigger, Tab closes. Clicking outside closes it. Used for the three-dots menus and the account menu.
 */
export const ActionMenu: React.FC<ActionMenuProps> = ({ label, items, className = '', trigger, triggerClassName, header, align = 'right' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const focusItem = (index: number) => {
    const count = items.length;
    itemRefs.current[(index + count) % count]?.focus();
  };

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const current = itemRefs.current.findIndex((el) => el === document.activeElement);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        focusItem(current + 1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        focusItem(current - 1);
        break;
      case 'Home':
        e.preventDefault();
        focusItem(0);
        break;
      case 'End':
        e.preventDefault();
        focusItem(items.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        close();
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  return (
    // `relative z-10` keeps the menu above a card's stretched link
    <div ref={rootRef} className={`relative z-10 ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={trigger ? triggerClassName ?? '' : DEFAULT_TRIGGER}
      >
        {trigger ?? <MoreVertical className="h-5 w-5" aria-hidden />}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={`absolute z-30 mt-1 min-w-52 overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-pop ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {header && <div className="border-b border-line px-4 py-3">{header}</div>}
          {items.map((item, i) => (
            <React.Fragment key={item.label}>
              {item.separated && <div role="separator" className="my-1 border-t border-line" />}
              <button
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitem"
                onClick={() => {
                  close(false);
                  item.onSelect();
                }}
                className={`flex min-h-11 w-full items-center gap-2.5 px-4 text-left text-sm transition-colors hover:bg-surface-2 focus:bg-surface-2 ${
                  item.danger ? 'text-danger-text' : 'text-fg'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebounce } from './useDebounce';

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error';

interface Options<V> {
  values: V;
  /** autosave only runs while enabled (turn it off while publishing, or when editing a published dream) */
  enabled: boolean;
  /** nothing worth saving yet: skip */
  isEmpty: (values: V) => boolean;
  /** persists the values; must be safe to call repeatedly (create the first time, update afterwards) */
  save: (values: V) => Promise<void>;
  /** the values already stored on the server, so opening a draft does not immediately re-save it */
  initial?: V;
  delayMs?: number;
}

/**
 * Debounced autosave for a form. At most one save is in flight; edits made meanwhile are saved right after,
 * so the last keystrokes are never lost. `flush()` saves now and resolves when everything is stored.
 */
export function useDraftAutosave<V>({ values, enabled, isEmpty, save, initial, delayMs = 1500 }: Options<V>) {
  const [state, setState] = useState<AutosaveState>('idle');
  const latest = useRef(values);
  latest.current = values;
  const saveRef = useRef(save);
  saveRef.current = save;

  const lastSaved = useRef<string | null>(initial === undefined ? null : JSON.stringify(initial));
  const running = useRef<Promise<void> | null>(null);

  const dirty = () => JSON.stringify(latest.current) !== lastSaved.current;

  const run = useCallback((): Promise<void> => {
    if (running.current) return running.current;

    const loop = async () => {
      try {
        // Keep saving until what is stored equals what is on screen.
        while (dirty() && !isEmpty(latest.current)) {
          const snapshot = latest.current;
          setState('saving');
          await saveRef.current(snapshot);
          lastSaved.current = JSON.stringify(snapshot);
        }
        setState('saved');
      } catch (error) {
        setState('error');
        throw error;
      } finally {
        running.current = null;
      }
    };

    running.current = loop();
    return running.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmpty]);

  const debounced = useDebounce(values, delayMs);
  useEffect(() => {
    if (!enabled || isEmpty(debounced)) return;
    if (JSON.stringify(debounced) === lastSaved.current) return;
    run().catch(() => {
      /* state is already "error"; the next edit retries */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced, enabled]);

  /** Records that `v` is what the server has (after an explicit save elsewhere). */
  const markSaved = useCallback((v: V) => {
    lastSaved.current = JSON.stringify(v);
  }, []);

  return {
    state,
    /** true when what is on screen differs from what is stored */
    hasUnsaved: JSON.stringify(values) !== lastSaved.current,
    flush: run,
    markSaved
  };
}

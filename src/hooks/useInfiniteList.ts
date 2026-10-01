import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteScroll } from './useInfiniteScroll';

export interface PageResult<T> {
  items: T[];
  hasMore: boolean;
  /** passed back to `fetchPage` to get the following page (a page number, a date cursor...) */
  next: string | number | null;
  total?: number;
  /** anything else the endpoint returns that the screen needs (for example per-tab counts) */
  meta?: unknown;
}

export type FetchPage<T> = (cursor: string | number | null, signal: AbortSignal) => Promise<PageResult<T>>;

/**
 * Paginated list with infinite scroll: loads the first page whenever `deps` change, then the next page each
 * time the sentinel returned as `sentinelRef` scrolls into view. Stale responses are ignored, and failures
 * keep what is already loaded and can be retried.
 *
 * Usage: `<div ref={sentinelRef} />` after the list.
 */
export function useInfiniteList<T>(fetchPage: FetchPage<T>, deps: unknown[]) {
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState<number | undefined>();
  const [meta, setMeta] = useState<unknown>();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cursor = useRef<string | number | null>(null);
  const controller = useRef<AbortController | null>(null);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback(async (reset: boolean) => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    if (reset) cursor.current = null;

    setLoading(true);
    setError(null);
    try {
      const page = await fetchRef.current(cursor.current, current.signal);
      if (current.signal.aborted) return;
      setItems((prev) => (reset ? page.items : [...prev, ...page.items]));
      setHasMore(page.hasMore);
      if (page.total !== undefined) setTotal(page.total);
      if (page.meta !== undefined) setMeta(page.meta);
      cursor.current = page.next;
    } catch (err) {
      if (current.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }, []);

  // First page, again whenever the filters change.
  useEffect(() => {
    load(true);
    return () => controller.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const loadMore = useCallback(() => load(false), [load]);
  const reload = useCallback(() => load(true), [load]);
  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loading && !error);

  return { items, setItems, total, meta, hasMore, loading, error, loadMore, reload, sentinelRef };
}

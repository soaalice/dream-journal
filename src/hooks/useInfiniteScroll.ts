import { useCallback, useRef } from 'react';

/**
 * Returns a ref callback for a sentinel element. `onReach` fires when it scrolls into view,
 * while `enabled` is true (set it false while loading or when there is nothing more to load).
 */
export function useInfiniteScroll(onReach: () => void, enabled: boolean) {
  const observer = useRef<IntersectionObserver | null>(null);
  const callback = useRef(onReach);
  callback.current = onReach;

  return useCallback(
    (node: HTMLElement | null) => {
      observer.current?.disconnect();
      if (!node || !enabled) return;
      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) callback.current();
        },
        { rootMargin: '400px' }
      );
      observer.current.observe(node);
    },
    [enabled]
  );
}

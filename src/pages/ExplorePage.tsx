import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CloudOff, Search, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useDebounce } from '../hooks/useDebounce';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useInfiniteList } from '../hooks/useInfiniteList';
import { MOODS, MOOD_LIST } from '../lib/moods';
import { Dream, DreamMood } from '../types';
import DreamCard from '../components/DreamCard';
import { Button } from '../components/ui/Button';
import { Chip } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Field';
import { DreamGridSkeleton } from '../components/ui/Skeleton';

const PAGE_SIZE = 12;

const parseList = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);
const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/**
 * All filters live in the URL (?q=&tag=&mood=), so results can be shared, bookmarked,
 * and survive a refresh or the back button. Filtering and paging happen on the server; more dreams load as you scroll.
 */
const ExplorePage: React.FC = () => {
  useDocumentTitle('Explore');
  const { publicFeed, fetchFeed, dataVersion } = useApp();
  const [params, setParams] = useSearchParams();

  const q = params.get('q') ?? '';
  const tags = useMemo(() => parseList(params.get('tag')), [params]);
  const moods = useMemo(() => parseList(params.get('mood')) as DreamMood[], [params]);

  const [searchText, setSearchText] = useState(q);
  const debouncedSearch = useDebounce(searchText.trim(), 300);

  const updateParams = useCallback(
    (next: { q?: string; tags?: string[]; moods?: string[] }) => {
      const merged = new URLSearchParams(params);
      const apply = (key: string, value?: string) => (value ? merged.set(key, value) : merged.delete(key));
      if (next.q !== undefined) apply('q', next.q);
      if (next.tags) apply('tag', next.tags.join(','));
      if (next.moods) apply('mood', next.moods.join(','));
      setParams(merged, { replace: true });
    },
    [params, setParams]
  );

  // Debounced search box -> URL
  useEffect(() => {
    if (debouncedSearch !== q) updateParams({ q: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const filterKey = `${q}|${tags.join(',')}|${moods.join(',')}`;

  const list = useInfiniteList<Dream>(
    async (cursor) => {
      const page = await fetchFeed({
        page: typeof cursor === 'number' ? cursor : 1,
        limit: PAGE_SIZE,
        q: q || undefined,
        tag: tags.join(',') || undefined,
        mood: moods.join(',') || undefined
      });
      return { items: page.dreams, hasMore: page.hasMore, next: page.page + 1, total: page.total };
    },
    [filterKey, dataVersion]
  );

  const popularTags = useMemo(() => {
    const counts = new Map<string, number>();
    publicFeed.forEach((d) => d.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1000));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).map(([t]) => t);
  }, [publicFeed, tags]);

  const hasFilters = Boolean(q) || tags.length > 0 || moods.length > 0;

  const resetFilters = () => {
    setSearchText('');
    setParams({}, { replace: true });
  };

  const total = list.total ?? 0;

  return (
    <div className="animate-fade-in">
      <h1 className="mb-1 font-serif text-3xl font-bold">Explore dreams</h1>
      <p className="mb-6 text-muted">Discover dreams shared by the community. Filter by feeling or theme.</p>

      {/* Sticky so filters stay reachable while scrolling a long list */}
      <div className="sticky top-16 z-20 -mx-4 mb-6 space-y-3 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
          <Input
            type="search"
            aria-label="Search dreams"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search dreams by keyword…"
            className="pl-10"
            maxLength={100}
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by mood">
          {MOOD_LIST.map((m) => {
            const { Icon, label } = MOODS[m];
            return (
              <Chip key={m} selected={moods.includes(m)} onClick={() => updateParams({ moods: toggle(moods, m) })} className="shrink-0">
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Chip>
            );
          })}
        </div>

        {popularTags.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by tag">
            {popularTags.map((tag) => (
              <Chip key={tag} selected={tags.includes(tag)} onClick={() => updateParams({ tags: toggle(tags, tag) })} className="shrink-0">
                #{tag}
              </Chip>
            ))}
          </div>
        )}

        <div className="flex min-h-6 items-center justify-between text-sm text-muted" aria-live="polite">
          <span>{list.loading && list.items.length === 0 ? 'Searching…' : `${total} ${total === 1 ? 'dream' : 'dreams'} found`}</span>
          {hasFilters && (
            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline">
              <X className="h-4 w-4" aria-hidden />
              Clear filters
            </button>
          )}
        </div>
      </div>

      {list.error && list.items.length === 0 && (
        <EmptyState
          tone="error"
          icon={<CloudOff className="h-12 w-12" />}
          title="Could not load dreams"
          description={list.error}
          action={<Button onClick={list.reload}>Retry</Button>}
        />
      )}

      {list.items.length > 0 && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {list.items.map((dream) => (
            <DreamCard key={dream._id} dream={dream} />
          ))}
        </div>
      )}

      {list.loading && (
        <div className={list.items.length > 0 ? 'mt-6' : ''}>
          <DreamGridSkeleton count={list.items.length > 0 ? 2 : 4} />
        </div>
      )}

      {!list.loading && !list.error && list.items.length === 0 && (
        <EmptyState
          icon={<Search className="h-12 w-12" />}
          title="No dreams found"
          description="Try different keywords or remove some filters."
          action={hasFilters ? <Button onClick={resetFilters}>Clear filters</Button> : undefined}
        />
      )}

      {list.error && list.items.length > 0 && (
        <div className="mt-6 text-center">
          <Button variant="secondary" onClick={list.loadMore}>
            Retry loading more
          </Button>
        </div>
      )}

      <div ref={list.sentinelRef} aria-hidden className="h-1" />
      {!list.hasMore && !list.loading && list.items.length > PAGE_SIZE && (
        <p className="mt-8 text-center text-sm text-muted">You have reached the end.</p>
      )}
    </div>
  );
};

export default ExplorePage;

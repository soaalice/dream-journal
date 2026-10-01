import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronDown, CloudOff, Search, SlidersHorizontal, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useDebounce } from '../hooks/useDebounce';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useInfiniteList } from '../hooks/useInfiniteList';
import { MOODS, MOOD_LIST } from '../lib/moods';
import { Dream, DreamMood } from '../types';
import DreamCard from '../components/DreamCard';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Chip } from '../components/ui/Chip';
import { EmptyState } from '../components/ui/EmptyState';
import { Input } from '../components/ui/Field';
import { Page, PageHeader } from '../components/ui/Page';
import { DreamGridSkeleton } from '../components/ui/Skeleton';

const PAGE_SIZE = 12;

const parseList = (value: string | null) => (value ? value.split(',').filter(Boolean) : []);
const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/**
 * All filters live in the URL (?q=&tag=&mood=), so results can be shared, bookmarked,
 * and survive a refresh or the back button. Filtering and paging happen on the server; more dreams load as you scroll.
 *
 * Only the search box stays pinned while scrolling. The mood and tag chips live in a panel you open on demand, so on a
 * phone the results get the screen instead of the filters.
 */
const ExplorePage: React.FC = () => {
  useDocumentTitle('Explore');
  const { publicFeed, fetchFeed, dataVersion } = useApp();
  const [params, setParams] = useSearchParams();

  const q = params.get('q') ?? '';
  const tags = useMemo(() => parseList(params.get('tag')), [params]);
  const moods = useMemo(() => parseList(params.get('mood')) as DreamMood[], [params]);
  const activeCount = tags.length + moods.length;

  const [searchText, setSearchText] = useState(q);
  const debouncedSearch = useDebounce(searchText.trim(), 300);
  // Open by default when arriving with filters (for example from a tag link), so they are not hidden.
  const [panelOpen, setPanelOpen] = useState(activeCount > 0);

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
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).map(([t]) => t);
  }, [publicFeed, tags]);

  const hasFilters = Boolean(q) || activeCount > 0;

  const resetFilters = () => {
    setSearchText('');
    setParams({}, { replace: true });
  };

  const total = list.total ?? 0;

  return (
    <Page>
      <PageHeader title="Explore dreams" description="Discover dreams shared by the community. Search, or filter by feeling and theme." />

      {/* the only sticky part: search and the filters toggle */}
      <div className="sticky top-16 z-20 -mx-4 mb-4 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              type="search"
              aria-label="Search dreams"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search dreams…"
              className="pl-10"
              maxLength={100}
            />
          </div>
          <Button
            variant={panelOpen || activeCount > 0 ? 'primary' : 'secondary'}
            onClick={() => setPanelOpen((v) => !v)}
            aria-expanded={panelOpen}
            aria-controls="explore-filters"
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Filters</span>
            {activeCount > 0 && <span className="rounded-full bg-white/25 px-1.5 text-xs tabular-nums">{activeCount}</span>}
            <ChevronDown className={`h-4 w-4 transition-transform ${panelOpen ? 'rotate-180' : ''}`} aria-hidden />
          </Button>
        </div>

        {/* what is applied, always visible and one tap to remove */}
        {activeCount > 0 && !panelOpen && (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5" role="group" aria-label="Active filters">
            {moods.map((m) => (
              <Chip key={m} selected onClick={() => updateParams({ moods: toggle(moods, m) })} className="shrink-0" aria-label={`Remove ${MOODS[m].label} filter`}>
                {MOODS[m].label} <X className="h-3.5 w-3.5" aria-hidden />
              </Chip>
            ))}
            {tags.map((t) => (
              <Chip key={t} selected onClick={() => updateParams({ tags: toggle(tags, t) })} className="shrink-0" aria-label={`Remove tag ${t}`}>
                #{t} <X className="h-3.5 w-3.5" aria-hidden />
              </Chip>
            ))}
          </div>
        )}
      </div>

      {panelOpen && (
        <Card id="explore-filters" className="mb-4 space-y-5">
          <div>
            <p className="eyebrow mb-2">Feeling</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by mood">
              {MOOD_LIST.map((m) => {
                const { Icon, label } = MOODS[m];
                return (
                  <Chip key={m} selected={moods.includes(m)} onClick={() => updateParams({ moods: toggle(moods, m) })}>
                    <Icon className="h-4 w-4" aria-hidden />
                    {label}
                  </Chip>
                );
              })}
            </div>
          </div>
          {popularTags.length > 0 && (
            <div>
              <p className="eyebrow mb-2">Themes</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by tag">
                {popularTags.map((tag) => (
                  <Chip key={tag} selected={tags.includes(tag)} onClick={() => updateParams({ tags: toggle(tags, tag) })}>
                    #{tag}
                  </Chip>
                ))}
              </div>
            </div>
          )}
          {hasFilters && (
            <button type="button" onClick={resetFilters} className="inline-flex items-center gap-1 text-sm font-medium text-accent-text hover:underline">
              <X className="h-4 w-4" aria-hidden />
              Clear all filters
            </button>
          )}
        </Card>
      )}

      <p className="meta mb-4 min-h-5" aria-live="polite">
        {list.loading && list.items.length === 0 ? 'Searching…' : `${total} ${total === 1 ? 'dream' : 'dreams'} found`}
        {hasFilters && !panelOpen && (
          <>
            {' · '}
            <button type="button" onClick={resetFilters} className="font-medium text-accent-text hover:underline">
              Clear filters
            </button>
          </>
        )}
      </p>

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
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
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
      {!list.hasMore && !list.loading && list.items.length > PAGE_SIZE && <p className="meta mt-8 text-center">You have reached the end.</p>}
    </Page>
  );
};

export default ExplorePage;

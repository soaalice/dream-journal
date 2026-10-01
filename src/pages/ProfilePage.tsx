import React, { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3, CalendarDays, CloudOff, Link as LinkIcon, MapPin, Moon, PenLine, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useInfiniteList } from '../hooks/useInfiniteList';
import { Dream, MyDreamsPage, PrivacyLevel } from '../types';
import { formatDate } from '../utils/date';
import DreamCard from '../components/DreamCard';
import Avatar from '../components/ui/Avatar';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Page } from '../components/ui/Page';
import { EmptyState } from '../components/ui/EmptyState';
import { DreamGridSkeleton } from '../components/ui/Skeleton';

type Tab = 'all' | PrivacyLevel | 'draft';
const TABS: Tab[] = ['all', 'public', 'private', 'anonymous', 'draft'];
const TAB_LABEL: Record<Tab, string> = { all: 'All', public: 'Public', private: 'Private', anonymous: 'Anonymous', draft: 'Drafts' };
const PAGE_SIZE = 12;

/**
 * Your own journal. There are no public profiles: nobody can open another person's page, people only meet
 * through dreams and comments.
 */
const ProfilePage: React.FC = () => {
  const { user } = useAuth();
  const { fetchMyDreams, dataVersion } = useApp();
  const [params, setParams] = useSearchParams();

  useDocumentTitle(user?.name);

  // The active tab is kept in the URL so it survives reloads and can be linked to.
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'all';
  const selectTab = useCallback((next: Tab) => setParams(next === 'all' ? {} : { tab: next }, { replace: true }), [setParams]);

  const list = useInfiniteList<Dream>(
    async (cursor) => {
      const page: MyDreamsPage = await fetchMyDreams({
        page: typeof cursor === 'number' ? cursor : 1,
        limit: PAGE_SIZE,
        status: tab === 'draft' ? 'draft' : 'published',
        privacyLevel: tab === 'public' || tab === 'private' || tab === 'anonymous' ? tab : undefined
      });
      return { items: page.dreams, hasMore: page.hasMore, next: page.page + 1, total: page.total, meta: page.counts };
    },
    [tab, dataVersion]
  );

  if (!user) return null;

  const counts = list.meta as MyDreamsPage['counts'] | undefined;

  return (
    <Page>
      <Card className="mb-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <Avatar src={user.avatarUrl} name={user.name} size="xl" />
            <div className="min-w-0">
              <h1 className="page-title text-3xl">{user.name}</h1>
              {user.bio && <p className="mt-1 max-w-prose text-muted">{user.bio}</p>}
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <li className="flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  Joined {formatDate(user.joinedAt)}
                </li>
                {user.location && (
                  <li className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" aria-hidden />
                    {user.location}
                  </li>
                )}
                {user.website && (
                  <li className="flex items-center gap-1">
                    <LinkIcon className="h-4 w-4" aria-hidden />
                    <a href={user.website} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-text hover:underline">
                      {user.website.replace(/^https?:\/\//, '')}
                    </a>
                  </li>
                )}
              </ul>
              <p className="mt-3 flex items-center gap-1.5 text-sm">
                <Moon className="h-4 w-4 text-accent-text" aria-hidden />
                <span>
                  <strong>{counts?.all ?? user.dreamCount}</strong> dreams
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <ButtonLink to="/stats" variant="secondary">
              <BarChart3 className="h-4 w-4" aria-hidden />
              Insights
            </ButtonLink>
            <ButtonLink to="/profile/edit" variant="secondary">
              <Settings className="h-4 w-4" aria-hidden />
              Edit profile
            </ButtonLink>
            <ButtonLink to="/new">
              <PenLine className="h-4 w-4" aria-hidden />
              New dream
            </ButtonLink>
          </div>
        </div>
      </Card>

      <div role="tablist" aria-label="Filter dreams" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => selectTab(t)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              tab === t ? 'border-accent text-accent-text' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            {TAB_LABEL[t]}
            {counts && <span className="ml-1 tabular-nums text-muted">({counts[t]})</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {list.error && list.items.length === 0 ? (
          <EmptyState
            tone="error"
            icon={<CloudOff className="h-12 w-12" />}
            title="Could not load your dreams"
            description={list.error}
            action={<Button onClick={list.reload}>Retry</Button>}
          />
        ) : (
          <>
            {list.items.length > 0 && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
                {list.items.map((dream) => (
                  <DreamCard key={dream._id} dream={dream} showPrivacy={tab === 'all' || tab === 'draft'} showAuthor={false} />
                ))}
              </div>
            )}

            {list.loading && (
              <div className={list.items.length > 0 ? 'mt-6' : ''}>
                <DreamGridSkeleton count={list.items.length > 0 ? 2 : 4} />
              </div>
            )}

            {!list.loading && list.items.length === 0 && (
              <EmptyState
                icon={<Moon className="h-12 w-12" />}
                title={tab === 'draft' ? 'No drafts' : 'No dreams here yet'}
                description={
                  tab === 'draft'
                    ? 'Anything you start writing is saved here until you publish it.'
                    : tab === 'all'
                      ? 'Your journal is empty. Record your first dream while you still remember it.'
                      : `You have no ${tab} dreams.`
                }
                action={<ButtonLink to="/new">Record a dream</ButtonLink>}
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
          </>
        )}
      </div>
    </Page>
  );
};

export default ProfilePage;

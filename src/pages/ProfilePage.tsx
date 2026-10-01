import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CalendarDays, CloudOff, Link as LinkIcon, MapPin, Moon, PenLine, Settings, UserCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Dream, PrivacyLevel, User } from '../types';
import { formatDate } from '../utils/date';
import DreamCard from '../components/DreamCard';
import Avatar from '../components/ui/Avatar';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { DreamGridSkeleton, Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';

type Tab = 'all' | PrivacyLevel;
const TABS: Tab[] = ['all', 'public', 'private', 'anonymous'];
const TAB_LABEL: Record<Tab, string> = { all: 'All', public: 'Public', private: 'Private', anonymous: 'Anonymous' };

const ProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { user: me } = useAuth();
  const { userDreams, feedLoading, getUser, fetchUserDreams, toggleFollow } = useApp();
  const [params, setParams] = useSearchParams();

  const isOwnProfile = !id || id === me?._id;
  const [other, setOther] = useState<{ user: User; dreams: Dream[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isOwnProfile || !id) {
      setOther(null);
      return;
    }
    let cancelled = false;
    setOther(null);
    setError(null);
    Promise.all([getUser(id), fetchUserDreams(id)])
      .then(([profile, dreams]) => !cancelled && setOther({ user: profile, dreams }))
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : 'Failed to load profile'));
    return () => {
      cancelled = true;
    };
  }, [id, isOwnProfile, attempt, getUser, fetchUserDreams]);

  const profile = isOwnProfile ? me : other?.user ?? null;
  const dreams = isOwnProfile ? userDreams : other?.dreams ?? [];

  useDocumentTitle(profile?.name);

  // The active tab is kept in the URL so it survives reloads and can be linked to.
  const tabParam = params.get('tab') as Tab | null;
  const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : 'all';
  const selectTab = useCallback(
    (next: Tab) => setParams(next === 'all' ? {} : { tab: next }, { replace: true }),
    [setParams]
  );

  const handleFollow = async () => {
    if (!other) return;
    try {
      const updated = await toggleFollow(other.user._id);
      setOther({ ...other, user: updated });
      toast.success(updated.isFollowing ? `You follow ${updated.name}` : `You unfollowed ${updated.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update follow');
    }
  };

  if (error) {
    return (
      <EmptyState
        tone="error"
        icon={<CloudOff className="h-12 w-12" />}
        title="Could not load this profile"
        description={error}
        action={<Button onClick={() => setAttempt((a) => a + 1)}>Retry</Button>}
      />
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6" role="status" aria-label="Loading profile">
        <Skeleton className="h-36 w-full rounded-xl" />
        <DreamGridSkeleton count={2} />
      </div>
    );
  }

  const counts: Record<Tab, number> = {
    all: dreams.length,
    public: dreams.filter((d) => d.privacyLevel === 'public').length,
    private: dreams.filter((d) => d.privacyLevel === 'private').length,
    anonymous: dreams.filter((d) => d.privacyLevel === 'anonymous').length
  };
  const visibleTabs = isOwnProfile ? TABS : [];
  const filtered = tab === 'all' ? dreams : dreams.filter((d) => d.privacyLevel === tab);
  const loadingOwn = isOwnProfile && feedLoading;

  return (
    <div className="animate-fade-in">
      <Card className="mb-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <Avatar src={profile.avatarUrl} name={profile.name} size="xl" />
            <div className="min-w-0">
              <h1 className="font-serif text-2xl font-bold">{profile.name}</h1>
              {profile.bio && <p className="mt-1 max-w-prose text-muted">{profile.bio}</p>}
              <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <li className="flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" aria-hidden />
                  Joined {formatDate(profile.joinedAt)}
                </li>
                {profile.location && (
                  <li className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" aria-hidden />
                    {profile.location}
                  </li>
                )}
                {profile.website && (
                  <li className="flex items-center gap-1">
                    <LinkIcon className="h-4 w-4" aria-hidden />
                    <a href={profile.website} target="_blank" rel="noopener noreferrer nofollow" className="text-accent-text hover:underline">
                      {profile.website.replace(/^https?:\/\//, '')}
                    </a>
                  </li>
                )}
              </ul>
              <dl className="mt-3 flex gap-5 text-sm">
                <div className="flex items-center gap-1.5">
                  <Moon className="h-4 w-4 text-accent-text" aria-hidden />
                  <dt className="sr-only">Dreams</dt>
                  <dd>
                    <strong>{profile.dreamCount}</strong> dreams
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">Followers</dt>
                  <dd>
                    <strong>{profile.followersCount}</strong> followers
                  </dd>
                </div>
                <div>
                  <dt className="sr-only">Following</dt>
                  <dd>
                    <strong>{profile.followingCount}</strong> following
                  </dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {isOwnProfile ? (
              <>
                <ButtonLink to="/profile/edit" variant="secondary">
                  <Settings className="h-4 w-4" aria-hidden />
                  Edit profile
                </ButtonLink>
                <ButtonLink to="/new">
                  <PenLine className="h-4 w-4" aria-hidden />
                  New dream
                </ButtonLink>
              </>
            ) : (
              <Button onClick={handleFollow} variant={profile.isFollowing ? 'secondary' : 'primary'} aria-pressed={profile.isFollowing}>
                {profile.isFollowing ? <UserCheck className="h-4 w-4" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
                {profile.isFollowing ? 'Following' : 'Follow'}
              </Button>
            )}
          </div>
        </div>
      </Card>

      {visibleTabs.length > 0 && (
        <div role="tablist" aria-label="Filter dreams" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
          {visibleTabs.map((t) => (
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
              {TAB_LABEL[t]} <span className="ml-1 tabular-nums text-muted">({counts[t]})</span>
            </button>
          ))}
        </div>
      )}

      {loadingOwn ? (
        <DreamGridSkeleton count={2} />
      ) : filtered.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2" role={visibleTabs.length ? 'tabpanel' : undefined}>
          {filtered.map((dream) => (
            <DreamCard key={dream._id} dream={dream} showPrivacy={isOwnProfile && tab === 'all'} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Moon className="h-12 w-12" />}
          title="No dreams here yet"
          description={
            !isOwnProfile
              ? 'This person has not shared any public dreams yet.'
              : tab === 'all'
                ? 'Your journal is empty. Record your first dream while you still remember it.'
                : `You have no ${tab} dreams.`
          }
          action={isOwnProfile ? <ButtonLink to="/new">Record a dream</ButtonLink> : undefined}
        />
      )}
    </div>
  );
};

export default ProfilePage;

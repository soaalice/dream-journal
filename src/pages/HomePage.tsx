import React, { useState } from 'react';
import { ArrowRight, Globe, Lock, Moon, PenLine, UserX, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { readStorage, writeStorage } from '../lib/storage';
import DreamCard from '../components/DreamCard';
import { ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { DreamGridSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

const WELCOME_KEY = 'welcome-dismissed';

const privacyExplainer = [
  { Icon: Lock, title: 'Private', text: 'Only you can read it. Your personal journal.' },
  { Icon: Globe, title: 'Public', text: 'Share it with the community under your name.' },
  { Icon: UserX, title: 'Anonymous', text: 'Share it with everyone while your identity stays hidden.' }
];

/** First-run card: explains the three privacy levels and nudges the first entry. */
const Welcome: React.FC<{ signedIn: boolean; onDismiss: () => void }> = ({ signedIn, onDismiss }) => (
  <Card className="relative mb-10 bg-accent-soft/40">
    <button
      type="button"
      onClick={onDismiss}
      aria-label="Dismiss welcome"
      className="absolute right-3 top-3 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg"
    >
      <X className="h-5 w-5" />
    </button>
    <h2 className="mb-1 font-serif text-xl font-bold">{signedIn ? 'Record your first dream' : 'You decide who sees your dreams'}</h2>
    <p className="mb-5 max-w-2xl text-muted">
      {signedIn
        ? 'Dreams fade fast. Jot down whatever you remember, even a few lines. You choose who can read it.'
        : 'Every dream has one of three privacy levels, so you can journal freely and share only what you want.'}
    </p>
    <ul className="mb-5 grid gap-3 sm:grid-cols-3">
      {privacyExplainer.map(({ Icon, title, text }) => (
        <li key={title} className="flex gap-3 rounded-lg bg-surface p-4">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" aria-hidden />
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted">{text}</p>
          </div>
        </li>
      ))}
    </ul>
    <ButtonLink to={signedIn ? '/new' : '/auth?register=true'}>
      {signedIn ? 'Record a dream' : 'Create a free account'}
      <ArrowRight className="h-4 w-4" aria-hidden />
    </ButtonLink>
  </Card>
);

const HomePage: React.FC = () => {
  useDocumentTitle();
  const { user } = useAuth();
  const { publicFeed, userDreams, feedLoading } = useApp();
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => readStorage(WELCOME_KEY) === '1');

  const dismissWelcome = () => {
    writeStorage(WELCOME_KEY, '1');
    setWelcomeDismissed(true);
  };

  // Logged out: always explain the product. Logged in: only until the first dream.
  const showWelcome = !welcomeDismissed && (!user || (!feedLoading && userDreams.length === 0 && user.dreamCount === 0));

  return (
    <div className="animate-fade-in">
      <section className="mb-10">
        <h1 className="mb-3 font-serif text-3xl font-bold sm:text-4xl">
          <span className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent dark:from-purple-400 dark:to-blue-400">
            {user ? `Welcome back, ${user.name.split(' ')[0]}` : 'Your dreams, remembered'}
          </span>
        </h1>
        <p className="mb-6 max-w-2xl text-lg text-muted">
          A place to record your dreams, spot patterns, and share them with a supportive community.
        </p>
        <div className="flex flex-wrap gap-3">
          {user && (
            <ButtonLink to="/new" size="lg">
              <PenLine className="h-5 w-5" aria-hidden />
              Record a dream
            </ButtonLink>
          )}
          <ButtonLink to="/explore" variant={user ? 'secondary' : 'primary'} size="lg">
            Explore dreams
          </ButtonLink>
        </div>
      </section>

      {showWelcome && <Welcome signedIn={Boolean(user)} onDismiss={dismissWelcome} />}

      <section aria-labelledby="recent-title">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="recent-title" className="font-serif text-2xl font-bold">
            Recent dreams
          </h2>
          <ButtonLink to="/explore" variant="ghost" size="sm">
            See all <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        </div>

        {feedLoading ? (
          <DreamGridSkeleton count={4} />
        ) : publicFeed.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {publicFeed.slice(0, 6).map((dream) => (
              <DreamCard key={dream._id} dream={dream} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Moon className="h-12 w-12" />}
            title="No shared dreams yet"
            description="Be the first to share a dream with the community."
            action={<ButtonLink to={user ? '/new' : '/auth?register=true'}>Share a dream</ButtonLink>}
          />
        )}
      </section>
    </div>
  );
};

export default HomePage;

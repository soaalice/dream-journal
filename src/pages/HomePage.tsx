import React, { useState } from 'react';
import { ArrowRight, BarChart3, Globe, Lock, Moon, PenLine, Sunrise, UserX, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { readStorage, writeStorage } from '../lib/storage';
import DreamCard from '../components/DreamCard';
import JournalSummary from '../components/home/JournalSummary';
import MoonArt from '../components/home/MoonArt';
import { ButtonLink } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Page, Section } from '../components/ui/Page';
import { DreamGridSkeleton } from '../components/ui/Skeleton';

const WELCOME_KEY = 'welcome-dismissed';

const privacyExplainer = [
  { Icon: Lock, title: 'Private', text: 'Only you can read it. Your personal journal.' },
  { Icon: Globe, title: 'Public', text: 'Share it with the community under your name.' },
  { Icon: UserX, title: 'Anonymous', text: 'Share it with everyone while your identity stays hidden.' }
];

const VALUE_POINTS = [
  { Icon: Sunrise, text: 'Capture a dream in seconds, even half asleep, by typing or speaking.' },
  { Icon: BarChart3, text: 'See your patterns: moods, themes and streaks over time.' },
  { Icon: Globe, text: 'Share what you want, publicly or anonymously, and keep the rest private.' }
];

/** "Good morning" and friends, from the person's own clock. */
const greeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

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
    <h2 className="section-title mb-1">{signedIn ? 'Record your first dream' : 'You decide who sees your dreams'}</h2>
    <p className="mb-5 max-w-2xl text-muted">
      {signedIn
        ? 'Dreams fade fast. Jot down whatever you remember, even a few lines. You choose who can read it.'
        : 'Every dream has one of three privacy levels, so you can journal freely and share only what you want.'}
    </p>
    <ul className="mb-5 grid gap-3 sm:grid-cols-3">
      {privacyExplainer.map(({ Icon, title, text }) => (
        <li key={title} className="flex gap-3 rounded-xl bg-surface p-4">
          <Icon className="mt-0.5 h-5 w-5 shrink-0 text-accent-text" aria-hidden />
          <div>
            <p className="font-medium">{title}</p>
            <p className="meta">{text}</p>
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

const GuestHero: React.FC = () => (
  <section className="mb-12 grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
    <div>
      <p className="eyebrow mb-3">A journal for your nights</p>
      <h1 className="page-title text-4xl sm:text-5xl">
        <span className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent dark:from-purple-400 dark:to-blue-400">
          Your dreams, remembered
        </span>
      </h1>
      <p className="mt-4 max-w-xl text-lg text-muted">Record your dreams, spot patterns, and share them with a supportive community.</p>
      <ul className="mt-6 space-y-3">
        {VALUE_POINTS.map(({ Icon, text }) => (
          <li key={text} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink to="/auth?register=true" size="lg">
          Start your journal
        </ButtonLink>
        <ButtonLink to="/explore" variant="secondary" size="lg">
          Explore dreams
        </ButtonLink>
      </div>
    </div>
    <MoonArt className="mx-auto hidden w-full max-w-sm md:block" />
  </section>
);

const MemberHero: React.FC<{ name: string }> = ({ name }) => (
  <section className="mb-12 grid items-stretch gap-6 md:grid-cols-[1.4fr_1fr]">
    <div className="flex flex-col justify-center">
      <p className="eyebrow mb-3">{greeting()}</p>
      <h1 className="page-title text-4xl sm:text-5xl">
        <span className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent dark:from-purple-400 dark:to-blue-400">
          Welcome back, {name}
        </span>
      </h1>
      <p className="mt-3 max-w-xl text-lg text-muted">What did you dream about? Get it down before it fades.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <ButtonLink to="/capture" size="lg">
          <Sunrise className="h-5 w-5" aria-hidden />
          I just woke up
        </ButtonLink>
        <ButtonLink to="/new" variant="secondary" size="lg">
          <PenLine className="h-5 w-5" aria-hidden />
          Record a dream
        </ButtonLink>
        <ButtonLink to="/explore" variant="ghost" size="lg">
          Explore dreams
        </ButtonLink>
      </div>
    </div>
    <JournalSummary />
  </section>
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
  const showWelcome = !welcomeDismissed && Boolean(user) && !feedLoading && userDreams.length === 0 && user?.dreamCount === 0;

  return (
    <Page>
      {user ? <MemberHero name={user.name.split(' ')[0]} /> : <GuestHero />}

      {showWelcome && <Welcome signedIn onDismiss={dismissWelcome} />}

      <Section
        title="Recent dreams"
        hint="Shared by the community"
        action={
          <ButtonLink to="/explore" variant="ghost" size="sm">
            See all <ArrowRight className="h-4 w-4" aria-hidden />
          </ButtonLink>
        }
      >
        {feedLoading ? (
          <DreamGridSkeleton count={4} />
        ) : publicFeed.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
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
      </Section>
    </Page>
  );
};

export default HomePage;

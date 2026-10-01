import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LogIn, Moon, PenLine } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ButtonLink, buttonClasses } from '../components/ui/Button';
import ThemeToggle from '../components/ui/ThemeToggle';
import NotificationBell from '../components/notifications/NotificationBell';
import UserMenu from './UserMenu';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-accent-soft text-accent-text' : 'text-muted hover:bg-surface-2 hover:text-fg'
  }`;

/** Top bar. On small screens navigation lives in BottomNav and the account menu, so this stays compact. */
const Header: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const staff = user?.role === 'admin' || user?.role === 'moderator';

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Dream Journal, home">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-purple-600 to-blue-500 text-white shadow-card">
            <Moon className="h-4 w-4" aria-hidden />
          </span>
          <span className="font-serif text-xl font-bold tracking-tight">Dream Journal</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          <NavLink to="/" end className={navClass}>
            Home
          </NavLink>
          <NavLink to="/explore" className={navClass}>
            Explore
          </NavLink>
          {isAuthenticated && (
            <>
              <NavLink to="/profile" end className={navClass}>
                My dreams
              </NavLink>
              <NavLink to="/stats" className={navClass}>
                Insights
              </NavLink>
            </>
          )}
          {staff && (
            <NavLink to="/admin" className={navClass}>
              Moderation
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          {isAuthenticated && user ? (
            <>
              <ButtonLink to="/new" className="mr-1 hidden md:inline-flex">
                <PenLine className="h-4 w-4" aria-hidden />
                New dream
              </ButtonLink>
              <NotificationBell />
              <ThemeToggle />
              <UserMenu />
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link to="/auth" className={buttonClasses('ghost', 'md')}>
                <LogIn className="h-4 w-4" aria-hidden />
                Sign in
              </Link>
              <ButtonLink to="/auth?register=true" className="hidden sm:inline-flex">
                Join
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;

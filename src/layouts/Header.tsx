import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, PenLine } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ui/Toast';
import { ButtonLink, buttonClasses } from '../components/ui/Button';
import ThemeToggle from '../components/ui/ThemeToggle';
import Avatar from '../components/ui/Avatar';

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-accent-soft text-accent-text' : 'text-fg hover:bg-surface-2'
  }`;

/** Top bar. On small screens navigation lives in BottomNav, so this stays compact. */
const Header: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    toast.info('You have been signed out');
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="font-serif text-xl font-bold">
          <span className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">DreamJournal</span>
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          <NavLink to="/" end className={navClass}>
            Home
          </NavLink>
          <NavLink to="/explore" className={navClass}>
            Explore
          </NavLink>
          {isAuthenticated && (
            <NavLink to="/profile" end className={navClass}>
              My dreams
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          {isAuthenticated && user ? (
            <>
              <ButtonLink to="/new" size="md" className="hidden md:inline-flex">
                <PenLine className="h-4 w-4" aria-hidden />
                New dream
              </ButtonLink>
              <ThemeToggle />
              <Link to="/profile" aria-label="Your profile" className="rounded-full">
                <Avatar src={user.avatarUrl} name={user.name} size="sm" />
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Sign out"
                className="hidden h-10 w-10 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg md:flex"
              >
                <LogOut className="h-5 w-5" />
              </button>
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

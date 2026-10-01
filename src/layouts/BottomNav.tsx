import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, PenLine, Search, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
    isActive ? 'text-accent-text' : 'text-muted hover:text-fg'
  }`;

/** One-handed navigation for phones; hidden from md up where the header has the links. */
const BottomNav: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <div className="mx-auto flex max-w-md items-stretch">
        <NavLink to="/" end className={itemClass}>
          <Home className="h-5 w-5" aria-hidden />
          Home
        </NavLink>
        <NavLink to="/explore" className={itemClass}>
          <Search className="h-5 w-5" aria-hidden />
          Explore
        </NavLink>
        <NavLink to={isAuthenticated ? '/new' : '/auth'} className="flex flex-1 items-center justify-center">
          <span className="-mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white shadow-pop">
            <PenLine className="h-6 w-6" aria-hidden />
            <span className="sr-only">New dream</span>
          </span>
        </NavLink>
        <NavLink to={isAuthenticated ? '/profile' : '/auth'} end className={itemClass}>
          <User className="h-5 w-5" aria-hidden />
          {isAuthenticated ? 'Profile' : 'Sign in'}
        </NavLink>
      </div>
    </nav>
  );
};

export default BottomNav;

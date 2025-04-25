import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu, Moon, Sun, PenLine, Home, User, Search, LogIn, UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ThemeToggle from './ui/ThemeToggle';
import Avatar from './ui/Avatar';

const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout, isDarkMode } = useApp();
  
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const publicNavLinks = [
    { name: 'Home', path: '/', icon: <Home className="w-5 h-5" /> },
    { name: 'Explore', path: '/explore', icon: <Search className="w-5 h-5" /> },
  ];

  const authNavLinks = [
    { name: 'Sign In', path: '/auth', icon: <LogIn className="w-5 h-5" /> },
    { name: 'Register', path: '/auth?register=true', icon: <UserPlus className="w-5 h-5" /> },
  ];

  const privateNavLinks = [
    { name: 'New Dream', path: '/new', icon: <PenLine className="w-5 h-5" /> },
    { name: 'Profile', path: '/profile', icon: <User className="w-5 h-5" /> },
  ];

  const navLinks = isAuthenticated ? [...publicNavLinks, ...privateNavLinks] : [...publicNavLinks, ...authNavLinks];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className={`
      sticky top-0 z-10 
      ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-800'}
      shadow-md transition-colors duration-300
    `}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2" onClick={() => navigate('/')} role="button">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-serif font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-500">
                DreamJournal
              </h1>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-6">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => navigate(link.path)}
                className={`
                  flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium
                  ${location.pathname === link.path 
                    ? 'bg-purple-100 text-purple-700' 
                    : isDarkMode 
                      ? 'hover:bg-gray-700' 
                      : 'hover:bg-gray-100'
                  }
                  transition-colors duration-200
                `}
              >
                {link.icon}
                <span>{link.name}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center space-x-4">
            <ThemeToggle />
            
            {isAuthenticated && user && (
              <div className="flex items-center space-x-2">
                <div 
                  className="flex items-center cursor-pointer"
                  onClick={() => navigate('/profile')}
                >
                  <Avatar 
                    src={user.avatarUrl} 
                    alt={user.name} 
                    size="sm"
                  />
                </div>
                <button
                  onClick={handleLogout}
                  className={`
                    text-sm font-medium px-3 py-2 rounded-md
                    ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}
                    transition-colors duration-200
                  `}
                >
                  Logout
                </button>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md focus:outline-none"
            >
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className={`
          md:hidden
          ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-800'}
          shadow-lg
        `}>
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => {
                  navigate(link.path);
                  setMobileMenuOpen(false);
                }}
                className={`
                  flex items-center space-x-3 w-full px-3 py-2 rounded-md text-base font-medium
                  ${location.pathname === link.path 
                    ? 'bg-purple-100 text-purple-700' 
                    : isDarkMode 
                      ? 'hover:bg-gray-700' 
                      : 'hover:bg-gray-100'
                  }
                `}
              >
                {link.icon}
                <span>{link.name}</span>
              </button>
            ))}
            
            {isAuthenticated && (
              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className={`
                  flex items-center space-x-3 w-full px-3 py-2 rounded-md text-base font-medium
                  ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}
                `}
              >
                <LogIn className="w-5 h-5" />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
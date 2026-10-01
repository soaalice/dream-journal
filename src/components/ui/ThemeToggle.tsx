import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const ThemeToggle: React.FC = () => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="flex h-11 w-11 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface-2 sm:h-10 sm:w-10"
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDarkMode ? <Sun className="h-5 w-5 text-yellow-300" /> : <Moon className="h-5 w-5 text-indigo-700" />}
    </button>
  );
};

export default ThemeToggle;

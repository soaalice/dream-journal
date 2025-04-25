import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useApp } from '../../context/AppContext';

const ThemeToggle: React.FC = () => {
  const { isDarkMode, setIsDarkMode } = useApp();

  return (
    <button 
      onClick={() => setIsDarkMode(!isDarkMode)}
      className="p-2 rounded-full transition-colors duration-200 ease-in-out"
      aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDarkMode ? (
        <Sun className="h-5 w-5 text-yellow-300" />
      ) : (
        <Moon className="h-5 w-5 text-indigo-800" />
      )}
    </button>
  );
};

export default ThemeToggle;
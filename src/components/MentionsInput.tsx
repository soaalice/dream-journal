import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';

interface MentionsInputProps {
  value: string;
  onChange: (value: string, mentions: string[]) => void;
  placeholder?: string;
  rows?: number;
}

const MentionsInput: React.FC<MentionsInputProps> = ({
  value,
  onChange,
  placeholder = '',
  rows = 3
}) => {
  const { isDarkMode, searchUsers } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Array<{ _id: string; name: string }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      if (searchTerm) {
        const results = await searchUsers(searchTerm);
        setSuggestions(results);
        setShowSuggestions(true);
      } else {
        setShowSuggestions(false);
      }
    };

    fetchUsers();
  }, [searchTerm, searchUsers]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const position = e.target.selectionStart || 0;
    setCursorPosition(position);

    // Check if we're in the middle of typing a mention
    const beforeCursor = text.slice(0, position);
    const match = beforeCursor.match(/@(\w*)$/);

    if (match) {
      setSearchTerm(match[1]);
    } else {
      setSearchTerm('');
    }

    // Extract mentions from text
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const mentions: string[] = [];
    let match2;
    while ((match2 = mentionRegex.exec(text)) !== null) {
      mentions.push(match2[2]); // Push the user ID
    }

    onChange(text, mentions);
  };

  const insertMention = (userId: string, userName: string) => {
    if (!inputRef.current) return;

    const beforeCursor = value.slice(0, cursorPosition);
    const afterCursor = value.slice(cursorPosition);
    const mentionMatch = beforeCursor.match(/@\w*$/);

    if (mentionMatch) {
      const newValue = beforeCursor.slice(0, mentionMatch.index) +
        `@[${userName}](${userId})` +
        afterCursor;

      const newMentions = [...(value.match(/@\[([^\]]+)\]\(([^)]+)\)/g) || []), userId];
      onChange(newValue, newMentions);
    }

    setShowSuggestions(false);
    setSearchTerm('');
  };

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleInput}
        placeholder={placeholder}
        rows={rows}
        className={`
          w-full rounded-md px-3 py-2 resize-none 
          ${isDarkMode
            ? 'bg-gray-700 text-white border-gray-600 focus:border-purple-500'
            : 'bg-gray-50 text-gray-900 border-gray-200 focus:border-purple-500'
          }
          border focus:ring-2 focus:ring-purple-200 focus:outline-none
          transition-colors duration-200
        `}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div className={`
          absolute z-10 w-full mt-1 rounded-md shadow-lg
          ${isDarkMode ? 'bg-gray-800' : 'bg-white'}
          border ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}
        `}>
          {suggestions.map((user) => (
            <button
              key={user._id}
              onClick={() => insertMention(user._id, user.name)}
              className={`
                w-full text-left px-4 py-2
                ${isDarkMode
                  ? 'hover:bg-gray-700 text-white'
                  : 'hover:bg-gray-100 text-gray-900'
                }
              `}
            >
              {user.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionsInput;
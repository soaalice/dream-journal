import React, { useEffect, useId, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { controlClasses } from './ui/Field';
import Avatar from './ui/Avatar';

interface MentionsInputProps {
  value: string;
  onChange: (value: string, mentions: string[]) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  autoFocus?: boolean;
  'aria-label'?: string;
}

type Suggestion = { _id: string; name: string; avatarUrl?: string };

const MENTION_TOKEN = /@\[([^\]]+)\]\(([0-9a-fA-F]{24})\)/g;

const extractMentionIds = (text: string): string[] =>
  Array.from(new Set(Array.from(text.matchAll(MENTION_TOKEN), (m) => m[2])));

/** Textarea with @mention autocomplete. Supports arrow keys, Enter/Tab to pick, Escape to close. */
const MentionsInput: React.FC<MentionsInputProps> = ({
  value,
  onChange,
  placeholder = '',
  rows = 3,
  maxLength = 1000,
  autoFocus = false,
  'aria-label': ariaLabel
}) => {
  const { searchUsers } = useApp();
  const listId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const open = searchTerm.length > 0 && suggestions.length > 0 && !dismissed;

  useEffect(() => {
    let cancelled = false;
    if (!searchTerm) {
      setSuggestions([]);
      return;
    }
    searchUsers(searchTerm).then((results) => {
      if (cancelled) return;
      setSuggestions(results);
      setActiveIndex(0);
    });
    return () => {
      cancelled = true;
    };
  }, [searchTerm, searchUsers]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    const position = e.target.selectionStart ?? 0;
    setCursorPosition(position);
    setDismissed(false);

    const match = text.slice(0, position).match(/@(\w*)$/);
    setSearchTerm(match ? match[1] : '');
    onChange(text, extractMentionIds(text));
  };

  const insertMention = (suggestion: Suggestion) => {
    const beforeCursor = value.slice(0, cursorPosition);
    const mention = beforeCursor.match(/@\w*$/);
    if (!mention || mention.index === undefined) return;

    const token = `@[${suggestion.name.replace(/[[\]()]/g, '')}](${suggestion._id}) `;
    const newValue = beforeCursor.slice(0, mention.index) + token + value.slice(cursorPosition);
    onChange(newValue, extractMentionIds(newValue));
    setSearchTerm('');
    setSuggestions([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDismissed(true);
    }
  };

  return (
    <div className="relative">
      <textarea
        ref={inputRef}
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        className={`${controlClasses(false)} resize-none`}
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-pop"
        >
          {suggestions.map((s, i) => (
            <li
              key={s._id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              // mousedown keeps the textarea focused so its cursor position survives
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(s);
              }}
              onMouseEnter={() => setActiveIndex(i)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 ${i === activeIndex ? 'bg-accent-soft text-accent-text' : ''}`}
            >
              <Avatar src={s.avatarUrl} name={s.name} size="sm" />
              {s.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MentionsInput;

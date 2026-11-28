// client/src/components/SearchBarAutocomplete.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Search, X, TrendingUp, Tag, ShoppingBag } from 'lucide-react';
import { m, AnimatePresence } from 'framer-motion';
import { searchApi } from '../services/api';
import { slideDown } from '../lib/motion';

const HighlightMatch = ({ text, query }) => {
  const cleanQuery = (query || '').trim();
  if (!cleanQuery) return <span>{text}</span>;

  const escaped = cleanQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'ig');
  const parts = String(text).split(regex);

  return (
    <span>
      {parts.map((part, idx) =>
        part.toLowerCase() === cleanQuery.toLowerCase() ? (
          <mark
            key={idx}
            className="bg-blue-500/30 text-blue-200 rounded px-0.5 font-semibold"
          >
            {part}
          </mark>
        ) : (
          <span key={idx}>{part}</span>
        )
      )}
    </span>
  );
};

/**
 * Search input with 250ms debounced autocomplete suggestions, keyboard navigation
 * (ArrowUp/ArrowDown/Enter/Escape), match highlighting, and popular searches on empty focus.
 */
export const SearchBarAutocomplete = ({
  initialValue = '',
  onSubmitSearch,
  onSelectCategory,
  placeholder = 'Search textbooks, cycles, electronics...',
  compact = false,
}) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [popularTerms, setPopularTerms] = useState([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  const containerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setInputValue(initialValue || '');
  }, [initialValue]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced autocomplete (250ms) when >= 2 chars
  useEffect(() => {
    const trimmed = inputValue.trim();
    if (!isOpen) return undefined;

    if (trimmed.length < 2) {
      setSuggestions([]);
      setLoadingSuggest(false);
      return undefined;
    }

    setLoadingSuggest(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchApi.suggest(trimmed);
        setSuggestions(res?.data?.suggestions || []);
        setActiveIndex(-1);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSuggest(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [inputValue, isOpen]);

  const handleFocus = async () => {
    setIsOpen(true);
    if (inputValue.trim().length < 2) {
      try {
        const res = await searchApi.popular();
        setPopularTerms(res?.data?.popular || []);
      } catch {
        setPopularTerms([]);
      }
    }
  };

  const trimmedQuery = inputValue.trim();
  const showingPopular = trimmedQuery.length < 2;
  const displayItems = showingPopular
    ? popularTerms.map((item) => ({ text: item.term, type: 'popular', count: item.count }))
    : suggestions;

  const commitItem = (item) => {
    setIsOpen(false);
    setActiveIndex(-1);
    if (item.type === 'category' && item.slug && onSelectCategory) {
      setInputValue('');
      onSelectCategory(item.slug, item.text);
      return;
    }
    setInputValue(item.text);
    onSubmitSearch?.(item.text);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isOpen && activeIndex >= 0 && displayItems[activeIndex]) {
      commitItem(displayItems[activeIndex]);
      return;
    }
    setIsOpen(false);
    setActiveIndex(-1);
    onSubmitSearch?.(inputValue.trim());
  };

  const handleKeyDown = (e) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsOpen(true);
      return;
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen || displayItems.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % displayItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? displayItems.length - 1 : prev - 1));
    }
  };

  const renderIcon = (type) => {
    if (type === 'category') return <Tag className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
    if (type === 'popular') return <TrendingUp className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    return <ShoppingBag className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit} role="search" className="relative flex items-center">
        <Search
          className={`absolute left-3 text-slate-400 pointer-events-none ${
            compact ? 'w-4 h-4' : 'w-4 h-4 sm:w-5 sm:h-5 left-3.5'
          }`}
        />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onFocus={handleFocus}
          onChange={(e) => {
            setInputValue(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label="Search marketplace"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          className={`w-full bg-slate-900/80 border border-slate-700 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
            compact
              ? 'pl-9 pr-16 py-1.5 rounded-xl text-xs sm:text-sm'
              : 'pl-10 pr-24 py-2.5 sm:py-3 rounded-xl text-sm'
          }`}
        />

        {inputValue && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setInputValue('');
              setSuggestions([]);
              onSubmitSearch?.('');
              inputRef.current?.focus();
            }}
            className={`absolute text-slate-400 hover:text-white p-1 transition ${
              compact ? 'right-12' : 'right-20'
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        <button
          type="submit"
          className={`absolute right-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold transition rounded-lg ${
            compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-xs sm:text-sm'
          }`}
        >
          Search
        </button>
      </form>

      {/* Autocomplete / Popular Dropdown */}
      <AnimatePresence>
        {isOpen && (displayItems.length > 0 || loadingSuggest) && (
          <m.div
            variants={slideDown}
            initial="initial"
            animate="animate"
            exit="exit"
            role="listbox"
            className="absolute left-0 right-0 mt-1.5 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden z-50"
          >
            <div className="px-3 py-1.5 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                {showingPopular ? 'Popular searches' : 'Suggestions'}
              </span>
              {loadingSuggest && (
                <span className="text-[11px] text-blue-400">Searching...</span>
              )}
            </div>

            <ul className="max-h-72 overflow-y-auto divide-y divide-slate-800/70">
              {displayItems.map((item, idx) => (
                <li key={`${item.type}-${item.text}-${idx}`}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={idx === activeIndex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commitItem(item);
                    }}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full px-3.5 py-2.5 text-left text-sm flex items-center justify-between gap-2 transition ${
                      idx === activeIndex
                        ? 'bg-blue-600/20 text-white'
                        : 'text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0 truncate">
                      {renderIcon(item.type)}
                      <span className="truncate">
                        <HighlightMatch text={item.text} query={trimmedQuery} />
                      </span>
                    </span>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                      {item.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};

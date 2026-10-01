import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, Filter, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import DreamCard from '../components/DreamCard';
import MoodBadge from '../components/ui/MoodBadge';
import { Dream, DreamMood } from '../types';

const ExplorePage: React.FC = () => {
  const location = useLocation();
  const { publicFeed, fetchFeed, isDarkMode } = useApp();
  
  const queryParams = new URLSearchParams(location.search);
  const initialTag = queryParams.get('tag') || '';
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTag ? [initialTag] : []);
  const [selectedMoods, setSelectedMoods] = useState<DreamMood[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [results, setResults] = useState<Dream[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filterKey = `${debouncedSearch}|${selectedTags.join(',')}|${selectedMoods.join(',')}`;

  // Filtering and pagination are done by the server so results are not limited to what was preloaded.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchFeed({
      page,
      limit: 12,
      q: debouncedSearch || undefined,
      tag: selectedTags.join(',') || undefined,
      mood: selectedMoods.join(',') || undefined
    })
      .then((res) => {
        if (cancelled) return;
        setResults((prev) => (page === 1 ? res.dreams : [...prev, ...res.dreams]));
        setHasMore(res.hasMore);
      })
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load dreams'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, page, fetchFeed]);

  useEffect(() => {
    setPage(1);
  }, [filterKey]);
  
  useEffect(() => {
    if (initialTag && !selectedTags.includes(initialTag)) {
      setSelectedTags([...selectedTags, initialTag]);
    }
  }, [initialTag]);
  
  // Extract all unique tags from dreams
  const allTags = Array.from(
    new Set([...selectedTags, ...publicFeed.flatMap(dream => dream.tags)])
  );
  
  const moods: DreamMood[] = [
    'happy', 'sad', 'scary', 'confusing',
    'exciting', 'peaceful', 'anxious', 'mysterious'
  ];
  
  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };
  
  const toggleMood = (mood: DreamMood) => {
    if (selectedMoods.includes(mood)) {
      setSelectedMoods(selectedMoods.filter(m => m !== mood));
    } else {
      setSelectedMoods([...selectedMoods, mood]);
    }
  };
  
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedTags([]);
    setSelectedMoods([]);
  };
  
  const filteredDreams = results;
  
  return (
    <div className={`max-w-5xl mx-auto px-4 py-8 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold mb-4">
          Explore Dreams
        </h1>
        <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-6`}>
          Discover dreams shared by the community. Use filters to find specific themes or emotions.
        </p>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <div className={`
              flex items-center flex-1 rounded-l-md px-3
              ${isDarkMode ? 'bg-gray-700' : 'bg-white'}
              border-y border-l
              ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}
            `}>
              <Search className="w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by keywords..."
                className={`
                  w-full py-2 px-3 bg-transparent
                  focus:outline-none
                `}
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`
                flex items-center gap-1 rounded-r-md px-4 py-2
                ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'} 
                border
                ${showFilters ? 'text-purple-600' : ''}
              `}
            >
              <Filter className="w-5 h-5" />
              <span className="hidden sm:inline">Filters</span>
            </button>
          </div>
          
          {showFilters && (
            <div className={`
              rounded-md p-4
              ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} 
              border
            `}>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Filter by Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={`
                          px-3 py-1 rounded-full text-sm
                          ${selectedTags.includes(tag)
                            ? 'bg-purple-100 text-purple-800'
                            : isDarkMode
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }
                          transition-colors duration-200
                        `}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Filter by Mood</h3>
                  <div className="flex flex-wrap gap-2">
                    {moods.map(mood => (
                      <button
                        key={mood}
                        onClick={() => toggleMood(mood)}
                        className={`
                          ${selectedMoods.includes(mood) ? 'ring-2 ring-purple-500' : ''}
                          rounded-md p-1 transition-all duration-200
                        `}
                      >
                        <MoodBadge mood={mood} />
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    onClick={resetFilters}
                    className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {(selectedTags.length > 0 || selectedMoods.length > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-500">Active filters:</span>
              {selectedTags.map(tag => (
                <span 
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`
                    inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm
                    bg-purple-100 text-purple-800 cursor-pointer
                  `}
                >
                  #{tag}
                  <X className="w-3 h-3" />
                </span>
              ))}
              {selectedMoods.map(mood => (
                <span 
                  key={mood}
                  onClick={() => toggleMood(mood)}
                  className="cursor-pointer"
                >
                  <MoodBadge mood={mood} size="sm" />
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div>
        {loadError && <p role="alert" className="mb-4 text-red-500">{loadError}</p>}
        {loading && filteredDreams.length === 0 && <p className="text-center py-16 text-gray-500">Loading...</p>}
        {!loading || filteredDreams.length > 0 ? (filteredDreams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredDreams.map((dream) => (
              <DreamCard key={dream._id} dream={dream} />
            ))}
          </div>
        ) : (
          <div className={`
            text-center py-16
            ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'} 
            rounded-lg
          `}>
            <Search className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No dreams found</h3>
            <p className="text-gray-500 mb-4">
              Try adjusting your filters or search terms.
            </p>
            <button
              onClick={resetFilters}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
            >
              Reset Filters
            </button>
          </div>
        )) : null}
        {hasMore && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={loading}
              className="px-5 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExplorePage;
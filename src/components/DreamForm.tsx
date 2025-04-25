import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { DreamMood, PrivacyLevel } from '../types';
import { X, Plus, AlertTriangle } from 'lucide-react';
import MoodBadge from './ui/MoodBadge';
import PrivacyBadge from './ui/PrivacyBadge';

interface DreamFormProps {
  editMode?: boolean;
  initialData?: {
    title: string;
    content: string;
    privacyLevel: PrivacyLevel;
    tags: string[];
    mood: DreamMood;
  };
}

const DreamForm: React.FC<DreamFormProps> = ({
  editMode = false,
  initialData = {
    title: '',
    content: '',
    privacyLevel: 'private',
    tags: [],
    mood: 'peaceful'
  }
}) => {
  const navigate = useNavigate();
  const { addDream, isDarkMode } = useApp();
  
  const [title, setTitle] = useState(initialData.title);
  const [content, setContent] = useState(initialData.content);
  const [privacyLevel, setPrivacyLevel] = useState<PrivacyLevel>(initialData.privacyLevel);
  const [tags, setTags] = useState<string[]>(initialData.tags);
  const [mood, setMood] = useState<DreamMood>(initialData.mood);
  
  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const moods: DreamMood[] = [
    'happy', 'sad', 'scary', 'confusing',
    'exciting', 'peaceful', 'anxious', 'mysterious'
  ];
  
  const privacyLevels: PrivacyLevel[] = ['public', 'private', 'anonymous'];
  
  const addTag = () => {
    const trimmedTag = newTag.trim().toLowerCase();
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag]);
      setNewTag('');
    }
  };
  
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };
  
  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };
  
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!content.trim()) {
      newErrors.content = 'Dream description is required';
    } else if (content.length < 10) {
      newErrors.content = 'Dream description must be at least 10 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    addDream({
      title,
      content,
      privacyLevel,
      tags,
      mood,
      likes: 0
    });
    
    navigate('/profile');
  };
  
  return (
    <form onSubmit={handleSubmit} className={`max-w-2xl mx-auto ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <div className="space-y-6">
        <div>
          <label htmlFor="title" className="block text-sm font-medium mb-1">
            Dream Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a title for your dream"
            className={`
              w-full px-4 py-2 rounded-md border 
              ${isDarkMode 
                ? 'bg-gray-700 text-white border-gray-600' 
                : 'bg-white text-gray-900 border-gray-300'
              }
              focus:outline-none focus:ring-2 focus:ring-purple-500
              transition-colors duration-200
              ${errors.title ? 'border-red-500 focus:ring-red-200' : ''}
            `}
          />
          {errors.title && (
            <p className="mt-1 text-red-500 text-sm flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {errors.title}
            </p>
          )}
        </div>
        
        <div>
          <label htmlFor="content" className="block text-sm font-medium mb-1">
            Dream Description
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe your dream in detail..."
            rows={6}
            className={`
              w-full px-4 py-2 rounded-md border 
              ${isDarkMode 
                ? 'bg-gray-700 text-white border-gray-600' 
                : 'bg-white text-gray-900 border-gray-300'
              }
              focus:outline-none focus:ring-2 focus:ring-purple-500
              transition-colors duration-200 resize-y
              ${errors.content ? 'border-red-500 focus:ring-red-200' : ''}
            `}
          />
          {errors.content && (
            <p className="mt-1 text-red-500 text-sm flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {errors.content}
            </p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">
            Dream Mood
          </label>
          <div className="flex flex-wrap gap-3">
            {moods.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMood(m)}
                className={`
                  ${mood === m ? 'ring-2 ring-purple-500' : ''}
                  rounded-md p-1 transition-all duration-200
                `}
              >
                <MoodBadge mood={m} />
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">
            Privacy Setting
          </label>
          <div className="flex flex-wrap gap-3">
            {privacyLevels.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setPrivacyLevel(level)}
                className={`
                  ${privacyLevel === level ? 'ring-2 ring-purple-500' : ''}
                  rounded-md p-1 transition-all duration-200
                `}
              >
                <PrivacyBadge privacy={level} />
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">
            Tags
          </label>
          <div className="flex items-center mb-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder="Add tags (press Enter)"
              className={`
                flex-1 px-4 py-2 rounded-l-md border 
                ${isDarkMode 
                  ? 'bg-gray-700 text-white border-gray-600' 
                  : 'bg-white text-gray-900 border-gray-300'
                }
                focus:outline-none focus:ring-2 focus:ring-purple-500
                transition-colors duration-200
              `}
            />
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2 bg-purple-600 text-white rounded-r-md hover:bg-purple-700 transition-colors duration-200"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <div 
                key={tag}
                className={`
                  flex items-center gap-1 rounded-full
                  ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} 
                  px-3 py-1
                `}
              >
                <span>#{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="text-gray-500 hover:text-red-500 transition-colors duration-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={`
              px-4 py-2 rounded-md
              ${isDarkMode 
                ? 'bg-gray-700 text-white hover:bg-gray-600' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }
              transition-colors duration-200
            `}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
          >
            {editMode ? 'Update Dream' : 'Save Dream'}
          </button>
        </div>
      </div>
    </form>
  );
};

export default DreamForm;
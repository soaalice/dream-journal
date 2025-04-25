import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PenLine, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import DreamCard from '../components/DreamCard';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { publicFeed, isDarkMode, user } = useApp();
  
  return (
    <div className={`max-w-5xl mx-auto px-4 py-8 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <div className="mb-8">
        <h1 className="text-3xl font-serif font-bold mb-4">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-500">
            Dream Journal
          </span>
        </h1>
        <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-6`}>
          A place to record and share your dreams with a supportive community.
        </p>
        
        <div className="flex flex-wrap gap-4">
          {user && (
            <button
              onClick={() => navigate('/new')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
            >
              <PenLine className="w-5 h-5" />
              Record Dream
            </button>
          )}
          <button
            onClick={() => navigate('/explore')}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-md
              ${isDarkMode 
                ? 'bg-gray-700 text-white hover:bg-gray-600' 
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }
              transition-colors duration-200
            `}
          >
            <Search className="w-5 h-5" />
            Explore Dreams
          </button>
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-2xl font-serif font-medium mb-4">Recent Dreams</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {publicFeed.slice(0, 6).map((dream) => (
            <DreamCard key={dream._id} dream={dream} />
          ))}
        </div>
      </div>
      
      <div className="flex justify-center mt-8">
        <button
          onClick={() => navigate('/explore')}
          className={`
            px-5 py-2 rounded-md
            ${isDarkMode 
              ? 'bg-gray-700 text-white hover:bg-gray-600' 
              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
            }
            transition-colors duration-200
          `}
        >
          Explore More Dreams
        </button>
      </div>
    </div>
  );
};

export default HomePage;
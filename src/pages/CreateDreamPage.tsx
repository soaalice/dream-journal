import React from 'react';
import DreamForm from '../components/DreamForm';
import { useApp } from '../context/AppContext';

const CreateDreamPage: React.FC = () => {
  const { isDarkMode } = useApp();
  
  return (
    <div className={`max-w-4xl mx-auto px-4 py-8 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <h1 className="text-3xl font-serif font-bold mb-2">Record New Dream</h1>
      <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-6`}>
        Share your dream experience. The more details you include, the more meaningful it will be.
      </p>
      
      <DreamForm />
    </div>
  );
};

export default CreateDreamPage;
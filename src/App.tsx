import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import DreamDetailPage from './pages/DreamDetailPage';
import ProfilePage from './pages/ProfilePage';
import ExplorePage from './pages/ExplorePage';
import CreateDreamPage from './pages/CreateDreamPage';
import EditProfilePage from './pages/EditProfilePage';
import AuthPage from './pages/AuthPage';

const AppContent: React.FC = () => {
  const { isDarkMode, isAuthenticated } = useApp();
  
  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} transition-colors duration-300`}>
      <Header />
      <main>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/dream/:id" element={<DreamDetailPage />} />
          <Route path="/dream/:id/edit" element={isAuthenticated ? <CreateDreamPage /> : <AuthPage />} />
          <Route path="/profile" element={isAuthenticated ? <ProfilePage /> : <AuthPage />} />
          <Route path="/profile/:id" element={isAuthenticated ? <ProfilePage /> : <AuthPage />} />
          <Route path="/profile/edit" element={isAuthenticated ? <EditProfilePage /> : <AuthPage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/new" element={isAuthenticated ? <CreateDreamPage /> : <AuthPage />} />
        </Routes>
      </main>
    </div>
  );
};

function App() {
  return (
    <AppProvider>
      <Router>
        <AppContent />
      </Router>
    </AppProvider>
  );
}

export default App;
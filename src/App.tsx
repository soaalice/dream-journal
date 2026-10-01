import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './components/ui/Confirm';
import { DreamGridSkeleton } from './components/ui/Skeleton';
import AppLayout from './layouts/AppLayout';
import RequireAuth from './layouts/RequireAuth';

// Route-level code splitting: each page is its own chunk.
const HomePage = lazy(() => import('./pages/HomePage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const DreamDetailPage = lazy(() => import('./pages/DreamDetailPage'));
const CreateDreamPage = lazy(() => import('./pages/CreateDreamPage'));
const EditDreamPage = lazy(() => import('./pages/EditDreamPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage'));
const AuthPage = lazy(() => import('./pages/AuthPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const AppRoutes: React.FC = () => {
  const { loading } = useAuth();

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10" role="status" aria-label="Loading">
        <DreamGridSkeleton count={2} />
      </div>
    );
  }

  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-10"><DreamGridSkeleton count={2} /></div>}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/dream/:id" element={<DreamDetailPage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/new" element={<CreateDreamPage />} />
            <Route path="/dream/:id/edit" element={<EditDreamPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/profile/edit" element={<EditProfilePage />} />
            <Route path="/profile/:id" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <AppProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </AppProvider>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;

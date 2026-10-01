import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Redirects to /auth and remembers where the user was heading, so login can send them back. */
const RequireAuth: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
};

export default RequireAuth;

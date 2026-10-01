import React, { lazy } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

/**
 * Moderation screens are for staff only; anyone else gets the ordinary "page not found", so the panel does not
 * advertise itself. `role="admin"` narrows it further to administrators (suspensions, audit log).
 * The real protection is on the server (every /api/admin route re-checks the role).
 */
const RequireAdmin: React.FC<{ role?: 'admin' }> = ({ role }) => {
  const { user } = useAuth();
  // Forward whatever the parent route provides (AdminLayout's counters), or nested admin pages lose it.
  const context = useOutletContext();
  const allowed = role === 'admin' ? user?.role === 'admin' : user?.role === 'admin' || user?.role === 'moderator';
  return allowed ? <Outlet context={context} /> : <NotFoundPage />;
};

export default RequireAdmin;

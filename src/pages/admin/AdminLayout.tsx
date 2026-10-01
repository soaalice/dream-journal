import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { AdminSummary } from '../../types/admin';

export interface AdminOutletContext {
  summary: AdminSummary | null;
  /** call after resolving a case or changing a suspension so the counters stay right */
  refreshSummary: () => void;
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors ${
    isActive ? 'border-accent text-accent-text' : 'border-transparent text-muted hover:text-fg'
  }`;

const AdminLayout: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [summary, setSummary] = useState<AdminSummary | null>(null);

  const refreshSummary = useCallback(() => {
    api<AdminSummary>('/admin/summary')
      .then(setSummary)
      .catch(() => {
        /* the counters are a convenience */
      });
  }, []);

  useEffect(refreshSummary, [refreshSummary]);

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
          <ShieldCheck className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h1 className="font-serif text-3xl font-bold">Moderation</h1>
          <p className="text-muted">Review reports, remove content and manage suspensions. Every action is logged.</p>
        </div>
      </div>

      <nav aria-label="Moderation" className="mb-6 flex gap-1 overflow-x-auto border-b border-line">
        <NavLink to="/admin/reports" className={tabClass}>
          Reports
          {summary && summary.open > 0 && (
            <span className="rounded-full bg-danger px-2 py-0.5 text-xs font-bold leading-none text-white" aria-label={`${summary.open} open`}>
              {summary.open}
            </span>
          )}
        </NavLink>
        {isAdmin && (
          <>
            <NavLink to="/admin/suspended" className={tabClass}>
              Suspended users
            </NavLink>
            <NavLink to="/admin/audit" className={tabClass}>
              Audit log
            </NavLink>
          </>
        )}
      </nav>

      <Outlet context={{ summary, refreshSummary } satisfies AdminOutletContext} />
    </div>
  );
};

export default AdminLayout;

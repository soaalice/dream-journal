import React, { useCallback, useEffect, useState } from 'react';
import { CloudOff, Search, ShieldCheck, UserCog } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { StaffMember } from '../../types/admin';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useConfirm } from '../../components/ui/Confirm';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input } from '../../components/ui/Field';
import { Skeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

type Role = StaffMember['role'];

const ROLE_LABEL: Record<Role, string> = { admin: 'Administrator', moderator: 'Moderator', user: 'Regular user' };
const ROLE_HELP: Record<Role, string> = {
  admin: 'Everything, including suspensions, the audit log and managing staff.',
  moderator: 'Handles reports and appeals. Cannot suspend, see emails or manage staff.',
  user: 'No access to the moderation panel.'
};

const RoleBadge: React.FC<{ role: Role }> = ({ role }) => (
  <span className={`rounded-full px-2.5 py-0.5 text-sm font-medium ${role === 'admin' ? 'bg-accent-soft text-accent-text' : 'bg-surface-2'}`}>{ROLE_LABEL[role]}</span>
);

/** Who is staff, and how to change it. Administrators only. Changes apply immediately. */
const AdminStaffPage: React.FC = () => {
  useDocumentTitle('Staff');
  const toast = useToast();
  const confirm = useConfirm();
  const { user: me } = useAuth();

  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query.trim(), 300);
  const [results, setResults] = useState<StaffMember[] | null>(null);

  const loadStaff = useCallback(() => {
    setError(null);
    api<{ staff: StaffMember[] }>('/admin/staff')
      .then((d) => setStaff(d.staff))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load staff'));
  }, []);

  useEffect(loadStaff, [loadStaff]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults(null);
      return;
    }
    let cancelled = false;
    api<{ users: StaffMember[] }>('/admin/users/search', { query: { q: debounced } })
      .then((d) => !cancelled && setResults(d.users))
      .catch(() => !cancelled && setResults([]));
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  const changeRole = async (person: StaffMember, role: Role) => {
    const demoting = role === 'user';
    const ok = await confirm({
      title: demoting ? `Remove ${person.name} from staff?` : `Make ${person.name} ${role === 'admin' ? 'an administrator' : 'a moderator'}?`,
      description: `${ROLE_LABEL[role]}: ${ROLE_HELP[role]} The change applies immediately.`,
      confirmLabel: demoting ? 'Remove from staff' : 'Change role',
      danger: demoting || role === 'admin'
    });
    if (!ok) return;
    try {
      await api(`/admin/users/${person._id}/role`, { method: 'PUT', body: { role } });
      toast.success(`${person.name} is now ${ROLE_LABEL[role].toLowerCase()}`);
      loadStaff();
      setResults((prev) => prev?.map((u) => (u._id === person._id ? { ...u, role } : u)) ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not change the role');
    }
  };

  const actions = (person: StaffMember) => {
    if (person._id === me?._id) return <span className="text-sm text-muted">You</span>;
    return (
      <div className="flex flex-wrap gap-2">
        {person.role !== 'moderator' && (
          <Button size="sm" variant="secondary" onClick={() => changeRole(person, 'moderator')} aria-label={`Make ${person.name} a moderator`}>
            {person.role === 'admin' ? 'Make moderator' : 'Make moderator'}
          </Button>
        )}
        {person.role !== 'admin' && (
          <Button size="sm" variant="secondary" onClick={() => changeRole(person, 'admin')} aria-label={`Make ${person.name} an administrator`}>
            Make admin
          </Button>
        )}
        {person.role !== 'user' && (
          <Button size="sm" variant="ghost" onClick={() => changeRole(person, 'user')} className="text-danger-text hover:bg-danger/10" aria-label={`Remove ${person.name} from staff`}>
            Remove
          </Button>
        )}
      </div>
    );
  };

  const row = (person: StaffMember) => (
    <li key={person._id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {person.name} <RoleBadge role={person.role} />
          {person.suspended && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-sm text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">Suspended</span>}
        </p>
        <p className="break-all text-sm text-muted">{person.email}</p>
      </div>
      {actions(person)}
    </li>
  );

  return (
    <div className="space-y-8">
      <section aria-labelledby="staff-title">
        <h2 id="staff-title" className="mb-3 font-serif text-xl font-bold">
          Current staff
        </h2>
        {error ? (
          <EmptyState tone="error" icon={<CloudOff className="h-12 w-12" />} title="Could not load staff" description={error} action={<Button onClick={loadStaff}>Retry</Button>} />
        ) : !staff ? (
          <div className="space-y-3" role="status" aria-label="Loading staff">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        ) : (
          <ul className="space-y-3">{staff.map(row)}</ul>
        )}
      </section>

      <Card as="section" aria-labelledby="add-title">
        <h2 id="add-title" className="mb-1 font-serif text-xl font-bold">
          Add staff
        </h2>
        <p className="mb-4 text-muted">Find an existing account by name or email, then give it a role. People must register first.</p>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
          <Input type="search" aria-label="Search accounts" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or email…" className="pl-10" maxLength={50} />
        </div>

        <div className="mt-4" aria-live="polite">
          {results && results.length === 0 && <p className="text-muted">No account matches.</p>}
          {results && results.length > 0 && <ul className="space-y-3">{results.map(row)}</ul>}
          {!results && query.trim().length > 0 && query.trim().length < 2 && <p className="text-sm text-muted">Type at least 2 characters.</p>}
        </div>

        <ul className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          {(['moderator', 'admin'] as const).map((r) => (
            <li key={r} className="flex gap-2 rounded-lg bg-surface-2 p-3">
              {r === 'admin' ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" aria-hidden /> : <UserCog className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" aria-hidden />}
              <span>
                <strong>{ROLE_LABEL[r]}</strong>
                <span className="block text-muted">{ROLE_HELP[r]}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

export default AdminStaffPage;

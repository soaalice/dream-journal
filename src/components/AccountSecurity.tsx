import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { useConfirm } from './ui/Confirm';
import { Field, PasswordInput } from './ui/Field';
import { useToast } from './ui/Toast';

const passwordRules = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

/** Password change and account deletion, shown on the profile edit page. */
const AccountSecurity: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { user, changePassword, deleteAccount } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>();
  const [changing, setChanging] = useState(false);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordRules.test(newPassword)) {
      setPasswordError('Use 8-72 characters with at least one letter and one number');
      return;
    }
    setChanging(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordError(undefined);
      toast.success('Password updated');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setChanging(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await confirm({
      title: 'Delete your account?',
      description: 'Your profile, dreams, comments and likes will be permanently removed. This cannot be undone.',
      confirmLabel: 'Delete everything',
      danger: true,
      requireText: user?.name ?? 'DELETE'
    });
    if (!ok) return;

    setDeleting(true);
    try {
      await deleteAccount(deletePassword);
      toast.success('Your account has been deleted');
      navigate('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
      setDeleting(false);
    }
  };

  return (
    <div className="mt-10 space-y-6">
      <Card as="section" aria-labelledby="password-title">
        <form onSubmit={handleChangePassword} className="space-y-4">
          <h2 id="password-title" className="font-serif text-xl font-bold">
            Change password
          </h2>
          <Field label="Current password">
            {({ id, invalid }) => (
              <PasswordInput id={id} invalid={invalid} autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            )}
          </Field>
          <Field label="New password" hint="8-72 characters, with a letter and a number" error={passwordError}>
            {({ id, describedBy, invalid }) => (
              <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            )}
          </Field>
          <Button type="submit" loading={changing} disabled={!currentPassword || !newPassword}>
            Update password
          </Button>
        </form>
      </Card>

      <Card as="section" aria-labelledby="delete-title" className="border-danger/40">
        <form onSubmit={handleDelete} className="space-y-4">
          <h2 id="delete-title" className="font-serif text-xl font-bold text-danger-text">
            Delete account
          </h2>
          <p className="text-sm text-muted">Removes your profile, dreams, comments and likes. This cannot be undone.</p>
          <Field label="Confirm with your password" error={deleteError}>
            {({ id, describedBy, invalid }) => (
              <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="current-password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} />
            )}
          </Field>
          <Button type="submit" variant="danger" loading={deleting} disabled={!deletePassword}>
            Delete my account
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default AccountSecurity;

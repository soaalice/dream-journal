import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

const inputClasses = (dark: boolean) => `
  w-full px-4 py-2 rounded-md border
  ${dark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-gray-900'}
  focus:outline-none focus:ring-2 focus:ring-purple-500
`;

const passwordRules = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;

/** Password change and account deletion, shown on the profile edit page. */
const AccountSecurity: React.FC = () => {
  const navigate = useNavigate();
  const { changePassword, deleteAccount, isDarkMode } = useApp();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordRules.test(newPassword)) {
      setPasswordMessage({ ok: false, text: 'New password needs 8-72 characters with a letter and a number' });
      return;
    }
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setPasswordMessage({ ok: true, text: 'Password updated' });
    } catch (err) {
      setPasswordMessage({ ok: false, text: err instanceof Error ? err.message : 'Failed to update password' });
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm('This permanently deletes your account and all your dreams. Continue?')) return;
    try {
      await deleteAccount(deletePassword);
      navigate('/');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete account');
    }
  };

  const card = `rounded-lg p-6 mt-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow`;

  return (
    <>
      <form onSubmit={handleChangePassword} className={`${card} space-y-4`}>
        <h2 className="text-xl font-serif font-bold">Change password</h2>
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={inputClasses(isDarkMode)}
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClasses(isDarkMode)}
        />
        {passwordMessage && (
          <p role="alert" className={`text-sm ${passwordMessage.ok ? 'text-green-600' : 'text-red-500'}`}>
            {passwordMessage.text}
          </p>
        )}
        <button
          type="submit"
          disabled={!currentPassword || !newPassword}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
        >
          Update password
        </button>
      </form>

      <form onSubmit={handleDelete} className={`${card} space-y-4 border border-red-300`}>
        <h2 className="text-xl font-serif font-bold text-red-600">Delete account</h2>
        <p className="text-sm text-gray-500">
          Removes your profile, dreams, comments and likes. This cannot be undone.
        </p>
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Confirm with your password"
          value={deletePassword}
          onChange={(e) => setDeletePassword(e.target.value)}
          className={inputClasses(isDarkMode)}
        />
        {deleteError && <p role="alert" className="text-sm text-red-500">{deleteError}</p>}
        <button
          type="submit"
          disabled={!deletePassword}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
        >
          Delete my account
        </button>
      </form>
    </>
  );
};

export default AccountSecurity;

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Moon, ShieldCheck, ShieldOff, User as UserIcon, UserCog, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ActionMenu, ActionMenuItem } from '../components/ui/ActionMenu';
import Avatar from '../components/ui/Avatar';
import { useToast } from '../components/ui/Toast';

/** The account dropdown: everything about "me" in one place instead of loose icons in the header. */
const UserMenu: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, logout } = useAuth();
  if (!user) return null;

  const icon = (Icon: React.ComponentType<{ className?: string }>) => <Icon className="h-4 w-4 text-muted" aria-hidden />;
  const staff = user.role === 'admin' || user.role === 'moderator';

  const items: ActionMenuItem[] = [
    { label: 'My dreams', icon: icon(Moon), onSelect: () => navigate('/profile') },
    { label: 'Insights', icon: icon(BarChart3), onSelect: () => navigate('/stats') },
    { label: 'Profile settings', icon: icon(UserCog), onSelect: () => navigate('/profile/edit') },
    { label: 'Blocked users', icon: icon(ShieldOff), onSelect: () => navigate('/blocked') },
    ...(staff ? [{ label: 'Moderation', icon: icon(ShieldCheck), onSelect: () => navigate('/admin') }] : []),
    {
      label: 'Sign out',
      icon: icon(LogOut),
      separated: true,
      onSelect: async () => {
        await logout();
        toast.info('You have been signed out');
        navigate('/');
      }
    }
  ];

  return (
    <ActionMenu
      label="Account menu"
      items={items}
      trigger={<Avatar src={user.avatarUrl} name={user.name} size="sm" />}
      triggerClassName="flex items-center rounded-full p-0.5 ring-offset-canvas transition hover:ring-2 hover:ring-accent/40"
      header={
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-text">
            <UserIcon className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
        </div>
      }
    />
  );
};

export default UserMenu;

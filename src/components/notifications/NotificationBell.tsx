import React from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../context/NotificationsContext';

/** Header bell with an unread badge (capped at 9+). */
const NotificationBell: React.FC = () => {
  const { unreadCount } = useNotifications();
  const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications';

  return (
    <Link
      to="/notifications"
      aria-label={label}
      className="relative flex h-11 w-11 items-center justify-center rounded-full text-fg transition-colors hover:bg-surface-2 sm:h-10 sm:w-10"
    >
      <Bell className="h-5 w-5" aria-hidden />
      {unreadCount > 0 && (
        <span
          aria-hidden
          className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
      {/* announces changes to screen readers without moving focus */}
      <span role="status" className="sr-only">
        {unreadCount > 0 ? `${unreadCount} unread notifications` : ''}
      </span>
    </Link>
  );
};

export default NotificationBell;

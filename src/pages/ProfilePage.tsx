import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Moon, PenLine, Settings, UserCheck, UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/date';
import DreamCard from '../components/DreamCard';
import Avatar from '../components/ui/Avatar';
import { Dream, User } from '../types';

const ProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user: me, userDreams, isDarkMode, getUser, fetchUserDreams, toggleFollow } = useApp();
  const [filter, setFilter] = useState<'all' | 'public' | 'private' | 'anonymous'>('all');
  const [other, setOther] = useState<{ user: User; dreams: Dream[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isOwnProfile = !id || id === me?._id;

  useEffect(() => {
    if (isOwnProfile || !id) {
      setOther(null);
      return;
    }
    let cancelled = false;
    setOther(null);
    setLoadError(null);
    Promise.all([getUser(id), fetchUserDreams(id)])
      .then(([profile, dreams]) => !cancelled && setOther({ user: profile, dreams }))
      .catch((err) => !cancelled && setLoadError(err instanceof Error ? err.message : 'Failed to load profile'));
    return () => {
      cancelled = true;
    };
  }, [id, isOwnProfile, getUser, fetchUserDreams]);

  const handleFollow = async () => {
    if (!other) return;
    try {
      const updated = await toggleFollow(other.user._id);
      setOther({ ...other, user: updated });
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to update follow');
    }
  };

  const user = isOwnProfile ? me : other?.user ?? null;
  const dreamsOfProfile = isOwnProfile ? userDreams : other?.dreams ?? [];

  if (!isOwnProfile && !other) {
    return (
      <div className="flex justify-center py-16 text-gray-500">
        {loadError ?? 'Loading...'}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-xl mb-4">Please log in to view your profile</h2>
        <button
          onClick={() => navigate('/auth')}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
        >
          Log In
        </button>
      </div>
    );
  }

  const filteredDreams = filter === 'all'
    ? dreamsOfProfile
    : dreamsOfProfile.filter(dream => dream.privacyLevel === filter);

  const tabClasses = {
    active: `
      border-b-2 border-purple-600 font-medium text-purple-600
    `,
    inactive: `
      text-gray-500 hover:text-gray-700 hover:border-gray-300 border-b-2 border-transparent
    `
  };

  return (
    <div className={`max-w-4xl mx-auto px-4 py-8 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <div className={`
        rounded-lg overflow-hidden shadow-lg
        ${isDarkMode ? 'bg-gray-800' : 'bg-white'}
        p-6 mb-8
      `}>
        <div className="md:flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Avatar src={user.avatarUrl} alt={user.name} size="xl" />
            <div>
              <h1 className="text-2xl font-bold">{user.name}</h1>
              <div className="flex items-center text-sm text-gray-500 mt-1">
                <CalendarDays className="h-4 w-4 mr-1" />
                <span>Joined {formatDate(new Date(user.joinedAt))}</span>
              </div>
            </div>
          </div>

          <div className="mt-4 md:mt-0 flex flex-wrap gap-2">
            <div className={`
              flex items-center gap-2 px-4 py-2 rounded-md
              ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}
            `}>
              <Moon className="h-5 w-5 text-purple-600" />
              <span className="font-medium">{user.dreamCount} Dreams</span>
            </div>

            <div className={`px-4 py-2 rounded-md ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <span className="font-medium">{user.followersCount} Followers</span>
              <span className="mx-2 text-gray-400">•</span>
              <span className="font-medium">{user.followingCount} Following</span>
            </div>

            {!isOwnProfile && (
              <button
                onClick={handleFollow}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
              >
                {user.isFollowing ? <UserCheck className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                {user.isFollowing ? 'Following' : 'Follow'}
              </button>
            )}

            {isOwnProfile && (<>
            <button
              onClick={() => navigate('/profile/edit')}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-md
                ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}
                transition-colors duration-200
              `}
            >
              <Settings className="h-5 w-5" />
              Edit Profile
            </button>

            <button
              onClick={() => navigate('/new')}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
            >
              <PenLine className="h-5 w-5" />
              New Dream
            </button>
            </>)}
          </div>
        </div>
      </div>

      {user.bio && <p className="mb-6 text-gray-500">{user.bio}</p>}

      {isOwnProfile && (
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            <button
              onClick={() => setFilter('all')}
              className={`py-4 px-1 ${filter === 'all' ? tabClasses.active : tabClasses.inactive}`}
            >
              All Dreams
            </button>
            <button
              onClick={() => setFilter('public')}
              className={`py-4 px-1 ${filter === 'public' ? tabClasses.active : tabClasses.inactive}`}
            >
              Public
            </button>
            <button
              onClick={() => setFilter('private')}
              className={`py-4 px-1 ${filter === 'private' ? tabClasses.active : tabClasses.inactive}`}
            >
              Private
            </button>
            <button
              onClick={() => setFilter('anonymous')}
              className={`py-4 px-1 ${filter === 'anonymous' ? tabClasses.active : tabClasses.inactive}`}
            >
              Anonymous
            </button>
          </nav>
        </div>
      </div>
      )}
      
      <div>
        {filteredDreams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredDreams.map((dream) => (
              <DreamCard key={dream._id} dream={dream} showPrivacy={isOwnProfile} />
            ))}
          </div>
        ) : (
          <div className={`
            text-center py-16
            ${isDarkMode ? 'bg-gray-800' : 'bg-gray-50'}
            rounded-lg
          `}>
            <Moon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No dreams found</h3>
            <p className="text-gray-500 mb-4">
              {!isOwnProfile
                ? 'No public dreams yet.'
                : filter === 'all'
                  ? "You haven't recorded any dreams yet."
                  : `You don't have any ${filter} dreams.`}
            </p>
            {isOwnProfile && (
              <button
                onClick={() => navigate('/new')}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
              >
                Record New Dream
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
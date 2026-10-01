import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Dream } from '../types';
import { formatDistanceToNow } from '../utils/date';
import { Heart, MessageSquare, Share2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import MoodBadge from './ui/MoodBadge';
import TagBadge from './ui/TagBadge';
import PrivacyBadge from './ui/PrivacyBadge';
import Avatar from './ui/Avatar';

interface DreamCardProps {
  dream: Dream;
  showPrivacy?: boolean;
}

const DreamCard: React.FC<DreamCardProps> = ({
  dream,
  showPrivacy = true
}) => {
  const {
    _id,
    title,
    content,
    createdAt,
    userId,
    userName,
    privacyLevel,
    tags,
    mood,
    likedByMe,
    likesCount,
    comments
  } = dream;

  const navigate = useNavigate();
  const { user, likeDream, isDarkMode } = useApp();
  const isLiked = likedByMe;

  const truncatedContent = content.length > 150
    ? `${content.substring(0, 150)}...`
    : content;

  const showAuthor = userId !== null;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate('/auth');
      return;
    }
    try {
      await likeDream(_id);
    } catch (error) {
      console.error('Error liking dream:', error);
    }
  };

  const handleComment = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      navigate('/auth');
      return;
    }
    navigate(`/dream/${_id}`);
  };

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    navigate(`/explore?tag=${tag}`);
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (userId) {
      navigate(`/profile/${userId._id}`);
    }
  };

  return (
    <div
      className={`
        ${isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'} 
        rounded-lg shadow-md overflow-hidden cursor-pointer transform transition-all duration-300 hover:-translate-y-1 hover:shadow-lg
      `}
      onClick={() => navigate(`/dream/${_id}`)}
    >
      <div className="p-5">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center space-x-3">
            {showAuthor && (
              <div onClick={handleProfileClick}>
                <Avatar
                  src={userId.avatarUrl}
                  alt={userName}
                  size="md"
                />
              </div>
            )}

            <div>
              <h2 className="text-lg font-bold font-serif mb-1">{title}</h2>
              <div className="flex items-center text-sm text-gray-500">
                <span>{userName}</span>
                <span className="mx-1">•</span>
                <span>{formatDistanceToNow(new Date(createdAt))}</span>
              </div>
            </div>
          </div>

          <div className="flex space-x-2">
            <MoodBadge mood={mood} />
            {showPrivacy && <PrivacyBadge privacy={privacyLevel} />}
          </div>
        </div>

        <p className={`mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
          {truncatedContent}
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {tags.map(tag => (
            <TagBadge
              key={tag}
              tag={tag}
              onClick={(e) => handleTagClick(e, tag)}
            />
          ))}
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
          <button
            className={`
              flex items-center space-x-1 px-2 py-1 rounded-full
              ${isLiked ? 'text-red-500' : isDarkMode ? 'text-gray-300 hover:text-red-500' : 'text-gray-500 hover:text-red-500'}
              transition-colors duration-200
              ${!user && 'opacity-50 cursor-not-allowed'}
            `}
            onClick={handleLike}
            disabled={!user}
          >
            <Heart className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} />
            <span>{likesCount}</span>
          </button>

          <button
            className={`
              flex items-center space-x-1 px-2 py-1 rounded-full
              ${isDarkMode ? 'text-gray-300 hover:text-blue-500' : 'text-gray-500 hover:text-blue-500'}
              transition-colors duration-200
              ${!user && 'opacity-50 cursor-not-allowed'}
            `}
            onClick={handleComment}
            disabled={!user}
          >
            <MessageSquare className="w-5 h-5" />
            <span>{comments.length}</span>
          </button>

          <button
            className={`
              flex items-center space-x-1 px-2 py-1 rounded-full
              ${isDarkMode ? 'text-gray-300 hover:text-green-500' : 'text-gray-500 hover:text-green-500'}
              transition-colors duration-200
            `}
            onClick={(e) => e.stopPropagation()}
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default DreamCard;
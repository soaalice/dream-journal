import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Comment } from '../types';
import { formatDistanceToNow } from '../utils/date';
import Avatar from './ui/Avatar';
import MentionsInput from './MentionsInput';

interface CommentSectionProps {
  dreamId: string;
  comments: Comment[];
}

const CommentSection: React.FC<CommentSectionProps> = ({ dreamId, comments }) => {
  const { user, addComment, isDarkMode } = useApp();
  const [commentText, setCommentText] = useState('');
  const [mentions, setMentions] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim()) {
      try {
        await addComment(dreamId, commentText, mentions);
        setCommentText('');
        setMentions([]);
      } catch (error) {
        console.error('Failed to add comment:', error);
      }
    }
  };

  const renderCommentContent = (content: string) => {
    // Replace mention placeholders with styled mentions
    return content.replace(/@\[([^\]]+)\]\(([^)]+)\)/g, (match, name) => {
      return `@${name}`;
    });
  };

  return (
    <div className={`${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <h3 className="text-lg font-semibold mb-4">Comments ({comments.length})</h3>

      {user && (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex space-x-3">
            <Avatar src={user.avatarUrl} alt={user.name} size="sm" />
            <div className="flex-1">
              <MentionsInput
                value={commentText}
                onChange={(value, newMentions) => {
                  setCommentText(value);
                  setMentions(newMentions);
                }}
                placeholder="Share your thoughts... Use @ to mention users"
                rows={3}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className={`
                    px-4 py-2 bg-purple-600 text-white rounded-md
                    ${commentText.trim() ? 'hover:bg-purple-700' : 'opacity-50 cursor-not-allowed'}
                    transition-colors duration-200
                  `}
                >
                  Comment
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {comments.length > 0 ? (
          comments.map((comment) => (
            <div key={comment._id} className="flex space-x-3">
              <Avatar src={comment.userAvatar} alt={comment.userName} size="sm" />
              <div className={`
                flex-1 p-3 rounded-lg
                ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}
              `}>
                <div className="flex justify-between">
                  <span className="font-medium">{comment.userName}</span>
                  <span className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(comment.createdAt))}
                  </span>
                </div>
                <p className={`mt-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {renderCommentContent(comment.content)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center py-4 text-gray-500">No comments yet. Be the first to comment!</p>
        )}
      </div>
    </div>
  );
};

export default CommentSection;
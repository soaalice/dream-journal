import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/date';
import MoodBadge from '../components/ui/MoodBadge';
import TagBadge from '../components/ui/TagBadge';
import PrivacyBadge from '../components/ui/PrivacyBadge';
import CommentSection from '../components/CommentSection';
import Avatar from '../components/ui/Avatar';

const DreamDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { allDreams, fetchDream, deleteDream, isDarkMode } = useApp();
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const [actionError, setActionError] = useState<string | null>(null);

  const dream = allDreams.find(d => d._id === id);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    fetchDream(id)
      .then(() => !cancelled && setStatus('ready'))
      .catch(() => !cancelled && setStatus('missing'));
    return () => {
      cancelled = true;
    };
  }, [id, fetchDream]);

  const handleDelete = async () => {
    if (!dream || !window.confirm('Delete this dream permanently?')) return;
    try {
      await deleteDream(dream._id);
      navigate('/profile');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to delete dream');
    }
  };

  if (!dream && status === 'loading') {
    return <div className="flex justify-center py-16 text-gray-500">Loading...</div>;
  }

  if (!dream) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <h2 className="text-xl mb-4">Dream not found</h2>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
        >
          Go Back
        </button>
      </div>
    );
  }

  const isOwnDream = dream.isOwner;

  return (
    <div className={`max-w-3xl mx-auto px-4 py-8 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <button
        onClick={() => navigate(-1)}
        className={`
          flex items-center mb-6 px-3 py-1 rounded-md
          ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}
          transition-colors duration-200
        `}
      >
        <ArrowLeft className="w-5 h-5 mr-1" />
        Back
      </button>

      <div className={`
        rounded-lg overflow-hidden shadow-lg
        ${isDarkMode ? 'bg-gray-800' : 'bg-white'} 
        p-6 md:p-8
      `}>
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center space-x-3">
            {dream.userId && (
              <Avatar
                src={dream.userId.avatarUrl}
                alt={dream.userName}
                size="lg"
              />
            )}

            <div>
              <h1 className="text-2xl font-serif font-bold">{dream.title}</h1>
              <div className="flex items-center text-sm text-gray-500 mt-1">
                <span>{dream.userName}</span>
                <span className="mx-1">•</span>
                <span>{formatDate(new Date(dream.createdAt))}</span>
              </div>
            </div>
          </div>

          <div className="flex space-x-2">
            <MoodBadge mood={dream.mood} size="md" />
            <PrivacyBadge privacy={dream.privacyLevel} size="md" />
          </div>
        </div>

        <div className="prose max-w-none mb-6 whitespace-pre-line">
          <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            {dream.content}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {dream.tags.map(tag => (
            <TagBadge
              key={tag}
              tag={tag}
              onClick={() => navigate(`/explore?tag=${encodeURIComponent(tag)}`)}
            />
          ))}
        </div>

        {isOwnDream && (
          <div className="mb-8 flex justify-end gap-2">
            {actionError && <p role="alert" className="text-red-500 text-sm self-center">{actionError}</p>}
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200"
            >
              <Trash2 className="w-5 h-5" />
              Delete
            </button>
            <button
              onClick={() => navigate(`/dream/${dream._id}/edit`)}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
            >
              <Edit className="w-5 h-5" />
              Edit Dream
            </button>
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-gray-200">
          <CommentSection dreamId={dream._id} comments={dream.comments} />
        </div>
      </div>
    </div>
  );
};

export default DreamDetailPage;
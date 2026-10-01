import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DreamForm from '../components/DreamForm';
import { useApp } from '../context/AppContext';

const EditDreamPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { allDreams, fetchDream, isDarkMode } = useApp();
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');

  const dream = allDreams.find((d) => d._id === id);

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

  useEffect(() => {
    // Only the author may edit; send everyone else back to the dream.
    if (status === 'ready' && dream && !dream.isOwner) navigate(`/dream/${dream._id}`, { replace: true });
  }, [status, dream, navigate]);

  if (status === 'missing' || (status === 'ready' && !dream)) {
    return <div className="max-w-4xl mx-auto px-4 py-8">Dream not found.</div>;
  }
  if (!dream || !dream.isOwner) {
    return <div className="max-w-4xl mx-auto px-4 py-8 text-gray-500">Loading...</div>;
  }

  return (
    <div className={`max-w-4xl mx-auto px-4 py-8 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <h1 className="text-3xl font-serif font-bold mb-6">Edit Dream</h1>
      <DreamForm
        editMode
        dreamId={dream._id}
        initialData={{
          title: dream.title,
          content: dream.content,
          privacyLevel: dream.privacyLevel,
          tags: dream.tags,
          mood: dream.mood
        }}
      />
    </div>
  );
};

export default EditDreamPage;

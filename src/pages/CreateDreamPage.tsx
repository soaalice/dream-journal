import React from 'react';
import DreamForm from '../components/DreamForm';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const CreateDreamPage: React.FC = () => {
  useDocumentTitle('Record a dream');

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="mb-1 font-serif text-3xl font-bold">Record a dream</h1>
      <p className="mb-8 text-muted">Write it down while it is fresh. Your draft is saved automatically.</p>
      <DreamForm />
    </div>
  );
};

export default CreateDreamPage;

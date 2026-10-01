import React from 'react';
import { Link } from 'react-router-dom';
import DreamForm from '../components/DreamForm';
import { Page, PageHeader } from '../components/ui/Page';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const CreateDreamPage: React.FC = () => {
  useDocumentTitle('Record a dream');

  return (
    <Page width="narrow">
      <PageHeader
        title="Record a dream"
        description={
          <>
            Write it down while it is fresh. Your draft is saved automatically.{' '}
            <Link to="/capture" className="font-medium text-accent-text hover:underline">
              Just woke up? Try quick capture.
            </Link>
          </>
        }
      />
      <DreamForm />
    </Page>
  );
};

export default CreateDreamPage;

import React from 'react';
import { Compass } from 'lucide-react';
import { ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

const NotFoundPage: React.FC = () => {
  useDocumentTitle('Page not found');
  return (
    <EmptyState
      icon={<Compass className="h-12 w-12" />}
      title="This page drifted away"
      description="The page you are looking for does not exist."
      action={<ButtonLink to="/">Back to home</ButtonLink>}
    />
  );
};

export default NotFoundPage;

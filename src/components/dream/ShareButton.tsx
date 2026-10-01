import React from 'react';
import { Share2 } from 'lucide-react';
import { useToast } from '../ui/Toast';

interface ShareButtonProps {
  dreamId: string;
  title: string;
  className?: string;
  withLabel?: boolean;
}

/** Native share sheet where available, otherwise copies the link. */
const ShareButton: React.FC<ShareButtonProps> = ({ dreamId, title, className = '', withLabel = false }) => {
  const toast = useToast();

  const share = async () => {
    const url = `${window.location.origin}/dream/${dreamId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard');
      }
    } catch (error) {
      // the user dismissing the share sheet is not an error
      if (!(error instanceof DOMException && error.name === 'AbortError')) toast.error('Could not share this dream');
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      aria-label="Share dream"
      className={`relative z-10 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-muted transition-colors hover:text-success sm:min-h-9 ${className}`}
    >
      <Share2 className="h-5 w-5" aria-hidden />
      {withLabel && <span className="text-sm">Share</span>}
    </button>
  );
};

export default ShareButton;

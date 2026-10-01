import React from 'react';
import { Flag, UserX } from 'lucide-react';
import { useModeration } from '../../context/ModerationContext';
import { ActionMenu } from '../ui/ActionMenu';

type ContentMenuProps =
  | { kind: 'dream'; dreamId: string; onBlocked?: () => void; className?: string }
  | { kind: 'comment'; dreamId: string; commentId: string; onBlocked?: () => void; className?: string };

/**
 * The three-dots menu on someone else's dream or comment: report it, or block its author.
 * The author's identity is resolved on the server, so this works for anonymous content without revealing it.
 */
const ContentMenu: React.FC<ContentMenuProps> = (props) => {
  const { reportDream, reportComment, blockDreamAuthor, blockCommentAuthor } = useModeration();
  const isComment = props.kind === 'comment';

  const report = () => (props.kind === 'comment' ? reportComment(props.dreamId, props.commentId) : reportDream(props.dreamId));

  const block = async () => {
    const done = props.kind === 'comment' ? await blockCommentAuthor(props.dreamId, props.commentId) : await blockDreamAuthor(props.dreamId);
    if (done) props.onBlocked?.();
  };

  return (
    <ActionMenu
      className={props.className}
      label={isComment ? 'Actions for this comment' : 'Actions for this dream'}
      items={[
        { label: isComment ? 'Report comment' : 'Report dream', icon: <Flag className="h-4 w-4" aria-hidden />, onSelect: report },
        { label: 'Block user', icon: <UserX className="h-4 w-4" aria-hidden />, onSelect: block, danger: true }
      ]}
    />
  );
};

export default ContentMenu;

import React, { useState } from 'react';
import { api } from '../../lib/api';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Textarea } from '../ui/Field';
import { useToast } from '../ui/Toast';

interface AppealDialogProps {
  open: boolean;
  onClose: () => void;
  /** the moderation notification being appealed */
  notificationId: string;
  title: string;
  onSent: () => void;
}

/** "Appeal this decision": the author explains why they think the removal was a mistake. */
const AppealDialog: React.FC<AppealDialogProps> = ({ open, onClose, notificationId, title, onSent }) => {
  const toast = useToast();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      await api('/appeals', { method: 'POST', body: { notificationId, message } });
      toast.success('Your appeal was sent. A moderator who was not involved will review it.');
      setMessage('');
      onSent();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your appeal');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Appeal this decision"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} loading={sending} disabled={message.trim().length < 10}>
            Send appeal
          </Button>
        </>
      }
    >
      <p className="mb-3 text-muted">
        Tell us why you think &ldquo;{title}&rdquo; should not have been removed. A different moderator will read this and decide.
      </p>
      <label htmlFor="appeal-message" className="mb-1 block text-sm font-medium">
        Your explanation
      </label>
      <Textarea id="appeal-message" rows={5} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} className="resize-none" />
      <p className="mt-1 text-right text-sm tabular-nums text-muted">{message.length}/1000</p>
      {error && (
        <p role="alert" className="mt-2 text-danger-text">
          {error}
        </p>
      )}
    </Modal>
  );
};

export default AppealDialog;

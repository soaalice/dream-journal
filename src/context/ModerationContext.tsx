import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { REPORT_REASONS } from '../lib/reports';
import { ReportReason } from '../types';
import { Button } from '../components/ui/Button';
import { useConfirm } from '../components/ui/Confirm';
import { Textarea } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { useApp } from './AppContext';

interface ModerationContextType {
  /** opens the report dialog for a dream */
  reportDream: (dreamId: string) => void;
  /** opens the report dialog for a comment */
  reportComment: (dreamId: string, commentId: string) => void;
  /** asks for confirmation, blocks the author of the dream, and resolves `true` if it happened */
  blockDreamAuthor: (dreamId: string) => Promise<boolean>;
  blockCommentAuthor: (dreamId: string, commentId: string) => Promise<boolean>;
}

const ModerationContext = createContext<ModerationContextType | undefined>(undefined);

type ReportTarget = { dreamId: string; commentId?: string };

const BLOCK_DESCRIPTION =
  'You will no longer see each other’s dreams or comments, and neither of you can interact with the other. ' +
  'They are not told that you blocked them. You can unblock them any time from your profile settings.';

/**
 * One place for "report" and "block", so every dream card and comment menu behaves the same and only one
 * dialog exists in the page.
 */
export const ModerationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const toast = useToast();
  const confirm = useConfirm();
  const { reloadDreams } = useApp();

  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const openReport = useCallback((next: ReportTarget) => {
    setReason('spam');
    setDetails('');
    setTarget(next);
  }, []);

  const submitReport = async () => {
    if (!target) return;
    setSubmitting(true);
    try {
      const path = target.commentId
        ? `/dreams/${target.dreamId}/comments/${target.commentId}/report`
        : `/dreams/${target.dreamId}/report`;
      await api(path, { method: 'POST', body: { reason, details } });
      toast.success('Thank you. Your report was sent to our moderators.');
      setTarget(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not send the report');
    } finally {
      setSubmitting(false);
    }
  };

  const block = useCallback(
    async (path: string) => {
      const ok = await confirm({
        title: 'Block this person?',
        description: BLOCK_DESCRIPTION,
        confirmLabel: 'Block',
        danger: true
      });
      if (!ok) return false;
      try {
        await api(path, { method: 'POST' });
        toast.success('User blocked. You can undo this in your profile settings.');
        reloadDreams();
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not block this user');
        return false;
      }
    },
    [confirm, toast, reloadDreams]
  );

  const value = useMemo<ModerationContextType>(
    () => ({
      reportDream: (dreamId) => openReport({ dreamId }),
      reportComment: (dreamId, commentId) => openReport({ dreamId, commentId }),
      blockDreamAuthor: (dreamId) => block(`/dreams/${dreamId}/block-author`),
      blockCommentAuthor: (dreamId, commentId) => block(`/dreams/${dreamId}/comments/${commentId}/block-author`)
    }),
    [openReport, block]
  );

  return (
    <ModerationContext.Provider value={value}>
      {children}
      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target?.commentId ? 'Report this comment' : 'Report this dream'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitReport} loading={submitting}>
              Send report
            </Button>
          </>
        }
      >
        <fieldset>
          <legend className="mb-3 text-sm text-muted">What is wrong with it? Your report is anonymous to the author.</legend>
          <div className="space-y-2">
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors focus-within:ring-2 focus-within:ring-accent ${
                  reason === r.value ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'
                }`}
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="mt-1 accent-purple-600"
                />
                <span>
                  <span className="block font-medium">{r.label}</span>
                  <span className="block text-sm text-muted">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="mt-4">
          <label htmlFor="report-details" className="mb-1 block text-sm font-medium">
            Details <span className="font-normal text-muted">(optional)</span>
          </label>
          <Textarea id="report-details" rows={3} maxLength={500} value={details} onChange={(e) => setDetails(e.target.value)} className="resize-none" />
          <p className="mt-1 text-right text-sm tabular-nums text-muted">{details.length}/500</p>
        </div>
      </Modal>
    </ModerationContext.Provider>
  );
};

export const useModeration = (): ModerationContextType => {
  const context = useContext(ModerationContext);
  if (!context) throw new Error('useModeration must be used within a ModerationProvider');
  return context;
};

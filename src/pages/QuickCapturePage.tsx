import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, Moon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import VoiceInputButton from '../components/VoiceInputButton';
import { Button } from '../components/ui/Button';
import { Page } from '../components/ui/Page';
import { Textarea } from '../components/ui/Field';
import { useToast } from '../components/ui/Toast';

interface Capture {
  content: string;
}

const isEmpty = (v: Capture) => v.content.trim() === '';

/**
 * "I just woke up": the fastest way to get a dream down before it fades. One big box (or your voice), saved as a
 * private draft while you write. Details (mood, privacy, tags) can wait until the full editor.
 */
const QuickCapturePage: React.FC = () => {
  useDocumentTitle('Quick capture');
  const navigate = useNavigate();
  const toast = useToast();
  const { addDream, updateDream } = useApp();

  const [values, setValues] = useState<Capture>({ content: '' });
  const draftId = useRef<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const save = useCallback(
    async (v: Capture) => {
      const payload = { title: '', content: v.content.trim(), privacyLevel: 'private' as const, mood: 'peaceful' as const, tags: [], status: 'draft' as const };
      if (draftId.current) await updateDream(draftId.current, payload);
      else draftId.current = (await addDream(payload))._id;
    },
    [addDream, updateDream]
  );

  const autosave = useDraftAutosave({ values, enabled: !leaving, isEmpty, save, delayMs: 1000 });

  // Warn before closing the tab with words that are not stored yet.
  useEffect(() => {
    if (!autosave.hasUnsaved || isEmpty(values) || leaving) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [autosave.hasUnsaved, values, leaving]);

  const append = useCallback((text: string) => {
    setValues((v) => ({ content: v.content && !/\s$/.test(v.content) ? `${v.content} ${text}` : `${v.content}${text}` }));
  }, []);

  const finish = async (next: 'drafts' | 'details') => {
    if (isEmpty(values)) return;
    setLeaving(true);
    try {
      await autosave.flush();
      if (next === 'details' && draftId.current) navigate(`/dream/${draftId.current}/edit`);
      else {
        toast.success('Saved to your drafts');
        navigate('/profile?tab=draft');
      }
    } catch (err) {
      setLeaving(false);
      toast.error(err instanceof Error ? err.message : 'Could not save your dream');
    }
  };

  const status =
    autosave.state === 'saving' ? (
      <>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving…
      </>
    ) : autosave.state === 'saved' ? (
      <>
        <Check className="h-4 w-4 text-success" aria-hidden /> Saved to your drafts
      </>
    ) : autosave.state === 'error' ? (
      'Could not save yet. We will retry as you type.'
    ) : (
      'Saved automatically as a private draft.'
    );

  return (
    <Page width="narrow">
      <div className="mb-6 text-center">
        <Moon className="mx-auto mb-2 h-8 w-8 text-accent-text" aria-hidden />
        <h1 className="page-title">Just woke up?</h1>
        <p className="mt-1.5 text-muted">Write or say what you remember, before it fades. Details can wait.</p>
      </div>

      <Textarea
        aria-label="Your dream"
        autoFocus
        rows={10}
        maxLength={10000}
        value={values.content}
        onChange={(e) => setValues({ content: e.target.value })}
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') finish('drafts');
        }}
        placeholder="I was… (type, or tap the microphone)"
        className="resize-y text-lg leading-relaxed"
      />

      <div className="mt-4">
        <VoiceInputButton onText={append} large />
      </div>

      <p role="status" className="mt-4 flex min-h-5 items-center justify-center gap-1.5 text-sm text-muted">
        {status}
      </p>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button size="lg" onClick={() => finish('details')} disabled={isEmpty(values) || leaving}>
          Add details and publish
        </Button>
        <Button size="lg" variant="secondary" onClick={() => finish('drafts')} disabled={isEmpty(values) || leaving}>
          Save for later
        </Button>
      </div>
      <p className="mt-6 text-center text-xs text-muted">
        Voice input uses your browser&apos;s speech recognition, which may send the audio to its provider (for example Google in Chrome).
        Nothing is sent to us until you save.
      </p>
    </Page>
  );
};

export default QuickCapturePage;

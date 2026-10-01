import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, Plus, AlertTriangle, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useDraftAutosave } from '../hooks/useDraftAutosave';
import { MOODS, MOOD_LIST, PRIVACY, PRIVACY_LIST } from '../lib/moods';
import { DreamMood, DreamStatus, PrivacyLevel } from '../types';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { useConfirm } from './ui/Confirm';
import { Field, Input, Textarea } from './ui/Field';
import { useToast } from './ui/Toast';

interface DreamFormValues {
  title: string;
  content: string;
  privacyLevel: PrivacyLevel;
  tags: string[];
  mood: DreamMood;
}

interface DreamFormProps {
  /** editing an existing dream (draft or published) instead of writing a new one */
  editMode?: boolean;
  dreamId?: string;
  /** status of the dream being edited; drafts autosave, published dreams do not */
  initialStatus?: DreamStatus;
  initialData?: DreamFormValues;
}

const LIMITS = { title: 120, content: 10000, tags: 10, tag: 30 };

const EMPTY: DreamFormValues = { title: '', content: '', privacyLevel: 'private', tags: [], mood: 'peaceful' };

const hasNothingToSave = (v: DreamFormValues) => v.content.trim() === '';

const DreamForm: React.FC<DreamFormProps> = ({ editMode = false, dreamId, initialStatus = 'published', initialData }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const { addDream, updateDream, deleteDream, allDreams } = useApp();

  // Drafts (new or reopened) autosave to the server; editing a published dream is an explicit "Update".
  const isDraftFlow = !editMode || initialStatus === 'draft';

  const [values, setValues] = useState<DreamFormValues>(initialData ?? EMPTY);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [publishing, setPublishing] = useState(false);
  const [done, setDone] = useState(false);

  // The id of the server-side draft: known up front when reopening one, assigned by the first autosave otherwise.
  const draftId = useRef<string | null>(editMode && initialStatus === 'draft' ? dreamId ?? null : null);

  const set = <K extends keyof DreamFormValues>(key: K, value: DreamFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const saveDraft = useCallback(
    async (v: DreamFormValues) => {
      const payload = { ...v, title: v.title.trim(), content: v.content.trim(), status: 'draft' as const };
      if (draftId.current) {
        await updateDream(draftId.current, payload);
      } else {
        draftId.current = (await addDream(payload))._id;
      }
    },
    [addDream, updateDream]
  );

  const autosave = useDraftAutosave({
    values,
    enabled: isDraftFlow && !publishing && !done,
    isEmpty: hasNothingToSave,
    save: saveDraft,
    initial: editMode && initialStatus === 'draft' ? initialData : undefined
  });

  // Published dreams have no autosave, so "unsaved" means "different from what was loaded".
  const publishedBaseline = useMemo(() => JSON.stringify(initialData ?? EMPTY), [initialData]);
  const hasUnsaved = isDraftFlow ? autosave.hasUnsaved && !hasNothingToSave(values) : JSON.stringify(values) !== publishedBaseline;

  // Warn before closing the tab while changes are not stored yet.
  useEffect(() => {
    if (!hasUnsaved || done) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsaved, done]);

  // Suggest the community's most used tags that are not selected yet.
  const suggestions = useMemo(() => {
    const counts = new Map<string, number>();
    allDreams.forEach((d) => d.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    const prefix = tagInput.trim().toLowerCase();
    return [...counts.entries()]
      .filter(([tag]) => !values.tags.includes(tag) && tag.startsWith(prefix))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag]) => tag);
  }, [allDreams, values.tags, tagInput]);

  const addTag = (raw: string) => {
    const tag = raw.trim().toLowerCase().replace(/^#/, '');
    if (!tag) return;
    if (tag.length > LIMITS.tag) return setErrors((e) => ({ ...e, tags: `Tags are at most ${LIMITS.tag} characters` }));
    if (values.tags.length >= LIMITS.tags) return setErrors((e) => ({ ...e, tags: `You can add up to ${LIMITS.tags} tags` }));
    setErrors((e) => ({ ...e, tags: '' }));
    if (!values.tags.includes(tag)) set('tags', [...values.tags, tag]);
    setTagInput('');
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && !tagInput && values.tags.length) {
      set('tags', values.tags.slice(0, -1));
    }
  };

  const validate = () => {
    const next: Record<string, string> = {};
    if (values.title.length > LIMITS.title) next.title = `Title must be at most ${LIMITS.title} characters`;
    if (values.content.trim().length < 10) next.content = 'Describe your dream in at least 10 characters to publish it';
    else if (values.content.length > LIMITS.content) next.content = `Description must be at most ${LIMITS.content} characters`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  /** Saves a draft right now. */
  const handleSaveDraft = async () => {
    if (hasNothingToSave(values)) {
      setErrors({ content: 'Write something first, then save it as a draft' });
      return;
    }
    try {
      await autosave.flush();
      toast.success('Draft saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the draft');
    }
  };

  /** Publishes a new dream, publishes a draft, or updates a published dream. */
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // The title is optional: fall back to the first line of the dream.
    const content = values.content.trim();
    const title = values.title.trim() || content.split('\n')[0].slice(0, 60);
    const payload = { ...values, title, content, status: 'published' as const };

    setPublishing(true);
    try {
      await autosave.flush().catch(() => undefined); // let an in-flight autosave finish first
      const targetId = editMode ? dreamId : draftId.current;
      const saved = targetId ? await updateDream(targetId, payload) : await addDream(payload);
      setDone(true);
      toast.success(editMode && initialStatus === 'published' ? 'Dream updated' : 'Dream published');
      navigate(`/dream/${saved._id}`);
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Failed to save dream' });
      setPublishing(false);
    }
  };

  const handleDiscard = async () => {
    const id = draftId.current;
    const ok = await confirm({
      title: 'Discard this draft?',
      description: 'The draft will be permanently deleted.',
      confirmLabel: 'Discard',
      danger: true
    });
    if (!ok) return;
    try {
      if (id) await deleteDream(id);
      setDone(true);
      toast.success('Draft discarded');
      navigate('/profile?tab=draft', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not discard the draft');
    }
  };

  const saveStatus = {
    idle: null,
    saving: (
      <>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Saving draft…
      </>
    ),
    saved: (
      <>
        <Check className="h-4 w-4 text-success" aria-hidden /> Draft saved
      </>
    ),
    error: (
      <>
        <AlertTriangle className="h-4 w-4 text-danger-text" aria-hidden /> Could not save the draft. We will retry when you type.
      </>
    )
  }[autosave.state];

  const publishLabel = editMode && initialStatus === 'published' ? 'Update dream' : 'Publish';

  return (
    <form onSubmit={handlePublish} className="space-y-8" noValidate>
      <Field label="What did you dream?" error={errors.content} counter={{ value: values.content.length, max: LIMITS.content }}>
        {({ id, describedBy, invalid }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            value={values.content}
            onChange={(e) => set('content', e.target.value)}
            placeholder="Write down everything you remember: places, people, feelings…"
            rows={10}
            autoFocus={!editMode}
            className="resize-y text-base leading-relaxed"
          />
        )}
      </Field>

      <Field
        label="Title"
        optional
        hint="Leave empty to use the first line."
        error={errors.title}
        counter={{ value: values.title.length, max: LIMITS.title }}
      >
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            aria-describedby={describedBy}
            invalid={invalid}
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Give it a title"
          />
        )}
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">How did it feel?</legend>
        <div className="flex flex-wrap gap-2">
          {MOOD_LIST.map((m) => {
            const { Icon, label } = MOODS[m];
            return (
              <Chip key={m} selected={values.mood === m} onClick={() => set('mood', m)}>
                <Icon className="h-4 w-4" aria-hidden />
                {label}
              </Chip>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Who can see it once published?</legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {PRIVACY_LIST.map((level) => {
            const { Icon, label, description } = PRIVACY[level];
            const selected = values.privacyLevel === level;
            return (
              <label
                key={level}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors focus-within:ring-2 focus-within:ring-accent ${
                  selected ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:bg-surface-2'
                }`}
              >
                <input
                  type="radio"
                  name="privacy"
                  value={level}
                  checked={selected}
                  onChange={() => set('privacyLevel', level)}
                  className="sr-only"
                />
                <span className="flex items-center gap-2 font-medium">
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </span>
                <span className="text-sm text-muted">{description}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Field
        label="Tags"
        optional
        error={errors.tags}
        counter={{ value: values.tags.length, max: LIMITS.tags }}
        hint="Press Enter or comma to add a tag."
      >
        {({ id, describedBy, invalid }) => (
          <div>
            {values.tags.length > 0 && (
              <ul className="mb-2 flex flex-wrap gap-2">
                {values.tags.map((tag) => (
                  <li key={tag} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1 text-sm text-accent-text">
                    #{tag}
                    <button
                      type="button"
                      onClick={() => set('tags', values.tags.filter((t) => t !== tag))}
                      aria-label={`Remove tag ${tag}`}
                      className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-accent/20"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="flying, sea, childhood…"
                maxLength={LIMITS.tag + 1}
              />
              <Button variant="secondary" onClick={() => addTag(tagInput)} aria-label="Add tag" disabled={!tagInput.trim()}>
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            {suggestions.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted">Popular:</span>
                {suggestions.map((tag) => (
                  <Chip key={tag} selected={false} onClick={() => addTag(tag)}>
                    #{tag}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        )}
      </Field>

      {errors.form && (
        <p role="alert" className="text-danger-text">
          {errors.form}
        </p>
      )}

      <div className="sticky bottom-20 space-y-2 rounded-xl border border-line bg-surface/90 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        {isDraftFlow && (
          <p role="status" className="flex min-h-5 items-center gap-1.5 text-sm text-muted">
            {saveStatus ?? 'Your work is saved as a draft while you write.'}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {isDraftFlow && (draftId.current || editMode) && (
            <Button variant="ghost" onClick={handleDiscard} className="mr-auto text-danger-text hover:bg-danger/10">
              Discard draft
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate(-1)}>
            {isDraftFlow ? 'Close' : 'Cancel'}
          </Button>
          {isDraftFlow && (
            <Button variant="secondary" onClick={handleSaveDraft} loading={autosave.state === 'saving'}>
              Save draft
            </Button>
          )}
          <Button type="submit" loading={publishing}>
            {publishLabel}
          </Button>
        </div>
      </div>
    </form>
  );
};

export default DreamForm;

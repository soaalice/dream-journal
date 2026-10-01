import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, RotateCcw, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from './ui/Toast';
import { useDebounce } from '../hooks/useDebounce';
import { readJson, removeStorage, writeJson } from '../lib/storage';
import { MOODS, MOOD_LIST, PRIVACY, PRIVACY_LIST } from '../lib/moods';
import { DreamMood, PrivacyLevel } from '../types';
import { Button } from './ui/Button';
import { Chip } from './ui/Chip';
import { Field, Input, Textarea } from './ui/Field';

interface DreamFormValues {
  title: string;
  content: string;
  privacyLevel: PrivacyLevel;
  tags: string[];
  mood: DreamMood;
}

interface DreamFormProps {
  editMode?: boolean;
  dreamId?: string;
  initialData?: DreamFormValues;
}

const DRAFT_KEY = 'dream-draft:v1';
const LIMITS = { title: 120, content: 10000, tags: 10, tag: 30 };

const EMPTY: DreamFormValues = { title: '', content: '', privacyLevel: 'private', tags: [], mood: 'peaceful' };

const DreamForm: React.FC<DreamFormProps> = ({ editMode = false, dreamId, initialData }) => {
  const navigate = useNavigate();
  const toast = useToast();
  const { addDream, updateDream, allDreams } = useApp();

  // New dreams restore an autosaved draft; edits always start from the saved dream.
  const [restoredDraft] = useState(() => (!editMode && !initialData ? readJson<DreamFormValues>(DRAFT_KEY) : null));
  const start = initialData ?? restoredDraft ?? EMPTY;

  const [values, setValues] = useState<DreamFormValues>(start);
  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draftNotice, setDraftNotice] = useState(restoredDraft !== null);

  const baseline = useMemo(() => JSON.stringify(initialData ?? EMPTY), [initialData]);
  const dirty = JSON.stringify(values) !== baseline;

  const set = <K extends keyof DreamFormValues>(key: K, value: DreamFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  // Autosave the draft of a new dream.
  const debounced = useDebounce(values, 600);
  useEffect(() => {
    if (editMode || saved) return;
    if (debounced.title || debounced.content || debounced.tags.length) writeJson(DRAFT_KEY, debounced);
  }, [debounced, editMode, saved]);

  // Warn before closing the tab with unsaved changes.
  useEffect(() => {
    if (!dirty || saved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty, saved]);

  const discardDraft = () => {
    removeStorage(DRAFT_KEY);
    setValues(EMPTY);
    setDraftNotice(false);
  };

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
    if (values.content.trim().length < 10) next.content = 'Describe your dream in at least 10 characters';
    else if (values.content.length > LIMITS.content) next.content = `Description must be at most ${LIMITS.content} characters`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // The title is optional: fall back to the first line of the dream.
    const content = values.content.trim();
    const title = values.title.trim() || content.split('\n')[0].slice(0, 60);
    const payload = { ...values, title, content };

    setSubmitting(true);
    try {
      if (editMode && dreamId) {
        await updateDream(dreamId, payload);
        setSaved(true);
        toast.success('Dream updated');
        navigate(`/dream/${dreamId}`);
      } else {
        const created = await addDream(payload);
        setSaved(true);
        removeStorage(DRAFT_KEY);
        toast.success('Dream saved');
        navigate(`/dream/${created._id}`);
      }
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : 'Failed to save dream' });
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8" noValidate>
      {draftNotice && (
        <div className="flex items-center justify-between gap-3 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent-text" role="status">
          <span>We restored your unsaved draft.</span>
          <button type="button" onClick={discardDraft} className="inline-flex items-center gap-1 font-semibold hover:underline">
            <RotateCcw className="h-4 w-4" aria-hidden />
            Start over
          </button>
        </div>
      )}

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
        <legend className="mb-2 text-sm font-medium">Who can see it?</legend>
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

      <div className="sticky bottom-20 flex justify-end gap-3 rounded-xl border border-line bg-surface/90 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <Button variant="secondary" onClick={() => navigate(-1)}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {editMode ? 'Update dream' : 'Save dream'}
        </Button>
      </div>
    </form>
  );
};

export default DreamForm;

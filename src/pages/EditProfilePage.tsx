import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { ProfileUpdateData } from '../types';
import AccountSecurity from '../components/AccountSecurity';
import BlockedPreview from '../components/moderation/BlockedPreview';
import EmojiAvatarPicker from '../components/EmojiAvatarPicker';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input, Textarea } from '../components/ui/Field';
import { useToast } from '../components/ui/Toast';

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name must be at most 50 characters'),
  bio: z.string().max(160, 'Bio must be at most 160 characters'),
  location: z.string().max(100, 'Location must be at most 100 characters'),
  website: z
    .string()
    .url('Enter a full URL, for example https://example.com')
    .refine((v) => /^https?:/i.test(v), 'Website must start with http:// or https://')
    .or(z.string().length(0)),
  avatarUrl: z.string().url('Invalid URL').or(z.string().length(0))
});

const EditProfilePage: React.FC = () => {
  useDocumentTitle('Edit profile');
  const navigate = useNavigate();
  const toast = useToast();
  const { user, updateProfile } = useAuth();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty }
  } = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name ?? '',
      bio: user?.bio ?? '',
      location: user?.location ?? '',
      website: user?.website ?? '',
      avatarUrl: user?.avatarUrl ?? ''
    }
  });

  const bio = watch('bio') ?? '';
  const avatarUrl = watch('avatarUrl');

  const onSubmit = async (data: ProfileUpdateData) => {
    try {
      await updateProfile(data);
      toast.success('Profile updated');
      navigate('/profile');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Profile update failed');
    }
  };

  return (
    <div className="mx-auto max-w-2xl animate-fade-in">
      <h1 className="mb-1 font-serif text-3xl font-bold">Edit profile</h1>
      <p className="mb-8 text-muted">Your name and avatar are shown on the dreams and comments you share publicly.</p>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <div>
            <p className="mb-2 text-sm font-medium">Avatar</p>
            <EmojiAvatarPicker
              initialAvatarUrl={avatarUrl}
              onAvatarChange={(url) => setValue('avatarUrl', url, { shouldDirty: true })}
            />
            {errors.avatarUrl && (
              <p role="alert" className="mt-1 text-sm text-danger-text">
                {errors.avatarUrl.message}
              </p>
            )}
          </div>

          <Field label="Name" error={errors.name?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="name" {...register('name')} />
            )}
          </Field>

          <Field label="Bio" optional error={errors.bio?.message} counter={{ value: bio.length, max: 160 }}>
            {({ id, describedBy, invalid }) => (
              <Textarea id={id} aria-describedby={describedBy} invalid={invalid} rows={3} className="resize-none" {...register('bio')} />
            )}
          </Field>

          <Field label="Location" optional error={errors.location?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} invalid={invalid} {...register('location')} />
            )}
          </Field>

          <Field label="Website" optional error={errors.website?.message}>
            {({ id, describedBy, invalid }) => (
              <Input id={id} aria-describedby={describedBy} invalid={invalid} type="url" placeholder="https://" {...register('website')} />
            )}
          </Field>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      <BlockedPreview />

      <AccountSecurity />
    </div>
  );
};

export default EditProfilePage;

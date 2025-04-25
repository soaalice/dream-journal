import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useApp } from '../context/AppContext';
import { ProfileUpdateData } from '../types';
import { AlertTriangle } from 'lucide-react';
import EmojiAvatarPicker from '../components/EmojiAvatarPicker';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  bio: z.string().max(160, 'Bio must be less than 160 characters'),
  location: z.string().max(100, 'Location must be less than 100 characters'),
  website: z.string().url('Invalid URL').or(z.string().length(0)),
  avatarUrl: z.string().url('Invalid URL').or(z.string().length(0)),
});

const EditProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateProfile, isDarkMode } = useApp();

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      bio: user?.bio || '',
      location: user?.location || '',
      website: user?.website || '',
      avatarUrl: user?.avatarUrl || '',
    },
  });

  const avatarUrl = watch('avatarUrl');

  const onSubmit = async (data: ProfileUpdateData) => {
    try {
      await updateProfile(data);
      navigate('/profile');
    } catch (error) {
      console.error('Profile update failed:', error);
    }
  };

  return (
    <div className={`max-w-2xl mx-auto px-4 py-8 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
      <h1 className="text-3xl font-serif font-bold mb-2">Edit Profile</h1>
      <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-600'} mb-6`}>
        Update your profile information and customize how others see you.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div>
          <label htmlFor="name" className="block text-sm font-medium mb-1">
            Name
          </label>
          <input
            {...register('name')}
            type="text"
            className={`
              w-full px-4 py-2 rounded-md border
              ${isDarkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
              }
              focus:outline-none focus:ring-2 focus:ring-purple-500
            `}
          />
          {errors.name && (
            <p className="mt-1 text-red-500 text-sm flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="bio" className="block text-sm font-medium mb-1">
            Bio
          </label>
          <textarea
            {...register('bio')}
            rows={3}
            className={`
              w-full px-4 py-2 rounded-md border
              ${isDarkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
              }
              focus:outline-none focus:ring-2 focus:ring-purple-500
              resize-none
            `}
          />
          {errors.bio && (
            <p className="mt-1 text-red-500 text-sm flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {errors.bio.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium mb-1">
            Location
          </label>
          <input
            {...register('location')}
            type="text"
            className={`
              w-full px-4 py-2 rounded-md border
              ${isDarkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
              }
              focus:outline-none focus:ring-2 focus:ring-purple-500
            `}
          />
          {errors.location && (
            <p className="mt-1 text-red-500 text-sm flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {errors.location.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="website" className="block text-sm font-medium mb-1">
            Website
          </label>
          <input
            {...register('website')}
            type="url"
            className={`
              w-full px-4 py-2 rounded-md border
              ${isDarkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'
              }
              focus:outline-none focus:ring-2 focus:ring-purple-500
            `}
          />
          {errors.website && (
            <p className="mt-1 text-red-500 text-sm flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {errors.website.message}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="avatarUrl" className="block text-sm font-medium mb-1">Avatar</label>
          <EmojiAvatarPicker
            initialAvatarUrl={avatarUrl}
            onAvatarChange={(url) => setValue('avatarUrl', url)}
            isDarkMode={isDarkMode}
          />
          {errors.avatarUrl && (
            <p className="mt-1 text-red-500 text-sm flex items-center">
              <AlertTriangle className="w-4 h-4 mr-1" />
              {errors.avatarUrl.message}
            </p>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={`
              px-4 py-2 rounded-md
              ${isDarkMode
                ? 'bg-gray-700 text-white hover:bg-gray-600'
                : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }
              transition-colors duration-200
            `}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProfilePage;
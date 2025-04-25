import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useApp } from '../context/AppContext';
import { ProfileUpdateData } from '../types';
import { AlertTriangle } from 'lucide-react';

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

  const { register, handleSubmit, formState: { errors }, setValue } = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      bio: user?.bio || '',
      location: user?.location || '',
      website: user?.website || '',
      avatarUrl: user?.avatarUrl || '',
    },
  });

  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>(user?.avatarUrl || '');

  const [emojiOptions] = useState({
    eyes: [
      'closed', 'closed2', 'crying', 'cute', 'glasses',
      'love', 'pissed', 'plain', 'sad', 'shades',
      'sleepClose', 'stars', 'tearDrop', 'wink', 'wink2'
    ],
    mouth: [
      'cute', 'drip', 'faceMask', 'kissHeart', 'lilSmile',
      'pissed', 'plain', 'sad', 'shout', 'shy',
      'sick', 'smileLol', 'smileTeeth', 'tongueOut', 'wideSmile'
    ],
    color: ['ffadad', 'ffd6a5', 'fdffb6', 'caffbf', '9bf6ff', 'a0c4ff', 'bdb2ff', 'ffc6ff']
  });

  const [selectedOptions, setSelectedOptions] = useState({
    eyes: 'cute',
    mouth: 'cute',
    color: 'a0c4ff'
  });

  useEffect(() => {
    if (user?.avatarUrl?.includes('dicebear')) {
      const url = new URL(user.avatarUrl);
      const params = new URLSearchParams(url.search);

      setSelectedOptions({
        eyes: params.get('eyes') || 'plain',
        mouth: params.get('mouth') || 'smileTeeth',
        color: params.get('backgroundColor')?.replace('#', '') || 'a0c4ff'
      });
    }
  }, [user?.avatarUrl]);

  const generateDiceBearUrl = (options: typeof selectedOptions) => {
    return `https://api.dicebear.com/8.x/fun-emoji/svg?eyes=${options.eyes}&mouth=${options.mouth}&backgroundColor=${options.color}`;
  };

  useEffect(() => {
    setSelectedAvatar(generateDiceBearUrl(selectedOptions));
  }, [selectedOptions]);

  const handleOptionChange = (type: keyof typeof selectedOptions, value: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [type]: value
    }));
  };

  const onSubmit = async (data: ProfileUpdateData) => {
    try {
      await updateProfile(data);
      navigate('/profile');
    } catch (error) {
      console.error('Profile update failed:', error);
    }
  };

  const handleRandomizeAvatar = () => {
    setSelectedOptions({
      eyes: emojiOptions.eyes[Math.floor(Math.random() * emojiOptions.eyes.length)],
      mouth: emojiOptions.mouth[Math.floor(Math.random() * emojiOptions.mouth.length)],
      color: emojiOptions.color[Math.floor(Math.random() * emojiOptions.color.length)]
    });
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
          <div className="flex items-center space-x-4">
            <img
              src={selectedAvatar}
              alt="Selected Avatar"
              className="w-12 h-12 rounded-full object-cover border-2 border-purple-500"
            />
            <button
              type="button"
              onClick={() => setIsAvatarModalOpen(true)}
              className={`px-4 py-2 rounded-md ${isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'} transition-colors duration-200`}
            >
              Customize Avatar
            </button>
          </div>
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

        {/* Avatar Customization Modal */}
        {isAvatarModalOpen && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-50 flex justify-center items-center z-50">
            <div className={`p-6 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h3 className="text-xl font-semibold mb-4">Customize Your Emoji Avatar</h3>

              <div className="flex flex-col items-center mb-6">
                <img
                  src={generateDiceBearUrl(selectedOptions)}
                  alt="Preview Avatar"
                  className="w-32 h-32 rounded-full border-4 border-purple-500 p-1 mb-4"
                />
                <button
                  onClick={handleRandomizeAvatar}
                  className={`px-4 py-2 rounded-md mb-2 ${isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}
                >
                  Randomize
                </button>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Eyes</label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {emojiOptions.eyes.map(eye => (
                      <button
                        key={eye}
                        type="button"
                        onClick={() => handleOptionChange('eyes', eye)}
                        className={`px-2 py-1 rounded text-sm transition-colors truncate ${selectedOptions.eyes === eye
                          ? 'bg-purple-500 text-white'
                          : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                      >
                        {eye}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Mouth</label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {emojiOptions.mouth.map(mouth => (
                      <button
                        key={mouth}
                        type="button"
                        onClick={() => handleOptionChange('mouth', mouth)}
                        className={`px-2 py-1 rounded text-sm transition-colors truncate ${selectedOptions.mouth === mouth
                          ? 'bg-purple-500 text-white'
                          : isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                      >
                        {mouth}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Background Color</label>
                  <div className="flex flex-wrap gap-2">
                    {emojiOptions.color.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleOptionChange('color', color)}
                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${selectedOptions.color === color
                          ? 'border-purple-500 scale-110'
                          : 'border-transparent'}`}
                        style={{ backgroundColor: `#${color}` }}
                        title={`#${color}`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setIsAvatarModalOpen(false)}
                  className={`px-4 py-2 rounded-md ${isDarkMode ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const newAvatarUrl = generateDiceBearUrl(selectedOptions);
                    setSelectedAvatar(newAvatarUrl);
                    setValue('avatarUrl', newAvatarUrl);
                    setIsAvatarModalOpen(false);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Save Avatar
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default EditProfilePage;
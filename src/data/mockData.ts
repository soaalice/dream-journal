import { Dream, User, PrivacyLevel, DreamMood } from '../types';

export const users: User[] = [
  {
    id: 'user-1',
    name: 'Luna Dreamer',
    avatarUrl: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
    dreamCount: 42,
    joinedAt: new Date('2024-01-15')
  },
  {
    id: 'user-2',
    name: 'Astra Knight',
    avatarUrl: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150',
    dreamCount: 28,
    joinedAt: new Date('2024-02-05')
  },
  {
    id: 'user-3',
    name: 'Morpheus Echo',
    avatarUrl: 'https://images.pexels.com/photos/614810/pexels-photo-614810.jpeg?auto=compress&cs=tinysrgb&w=150',
    dreamCount: 53,
    joinedAt: new Date('2023-12-20')
  }
];

export const currentUser: User = users[0];

export const dreams: Dream[] = [
  {
    id: 'dream-1',
    title: 'Flying Over Mountains',
    content: 'I dreamt I was soaring over magnificent mountain ranges. The air was crisp and clear, and I could see for miles in every direction. I felt an incredible sense of freedom and exhilaration.',
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-06-01'),
    userId: 'user-1',
    userName: 'Luna Dreamer',
    privacyLevel: 'public',
    tags: ['flying', 'mountains', 'freedom'],
    mood: 'exciting',
    likes: 24,
    comments: [
      {
        id: 'comment-1',
        content: 'I have similar flying dreams! They\'re always so liberating.',
        userId: 'user-2',
        userName: 'Astra Knight',
        userAvatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150',
        createdAt: new Date('2024-06-01T14:25:00')
      }
    ]
  },
  {
    id: 'dream-2',
    title: 'Lost in an Ancient Library',
    content: 'I found myself wandering through an impossibly vast library. The bookshelves reached up beyond what I could see, and every book seemed to contain secrets of the universe. I was searching for something specific, but I couldn\'t remember what it was.',
    createdAt: new Date('2024-05-28'),
    updatedAt: new Date('2024-05-28'),
    userId: 'user-2',
    userName: 'Astra Knight',
    privacyLevel: 'public',
    tags: ['library', 'books', 'searching', 'mystery'],
    mood: 'mysterious',
    likes: 17,
    comments: []
  },
  {
    id: 'dream-3',
    title: 'Ocean of Stars',
    content: 'The ocean and the night sky merged into one. I was swimming through stars and galaxies, each ripple creating new constellations. Fish made of light darted around me, guiding me deeper into the cosmic sea.',
    createdAt: new Date('2024-05-25'),
    updatedAt: new Date('2024-05-25'),
    userId: 'user-3',
    userName: 'Morpheus Echo',
    privacyLevel: 'public',
    tags: ['ocean', 'stars', 'cosmic', 'swimming'],
    mood: 'peaceful',
    likes: 31,
    comments: [
      {
        id: 'comment-2',
        content: 'This is absolutely beautiful! I wish I had dreams like this.',
        userId: 'user-1',
        userName: 'Luna Dreamer',
        userAvatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
        createdAt: new Date('2024-05-25T22:17:00')
      }
    ]
  },
  {
    id: 'dream-4',
    title: 'Endless Corridors',
    content: 'I was running through corridors that kept shifting and changing. Every door I opened led to another hallway. I had an urgent feeling of needing to find an exit, but the maze seemed to have a mind of its own.',
    createdAt: new Date('2024-05-22'),
    updatedAt: new Date('2024-05-22'),
    userId: 'user-1',
    userName: 'Luna Dreamer',
    privacyLevel: 'anonymous',
    tags: ['maze', 'running', 'doors', 'trapped'],
    mood: 'anxious',
    likes: 12,
    comments: []
  },
  {
    id: 'dream-5',
    title: 'Conversation with My Childhood Self',
    content: 'I met my 8-year-old self in our old backyard. We talked for hours, and strangely, she seemed to have wisdom I\'ve forgotten. She reminded me of dreams and aspirations I once had.',
    createdAt: new Date('2024-05-18'),
    updatedAt: new Date('2024-05-18'),
    userId: 'user-1',
    userName: 'Luna Dreamer',
    privacyLevel: 'private',
    tags: ['childhood', 'self-reflection', 'memories'],
    mood: 'peaceful',
    likes: 0,
    comments: []
  }
];

export const userDreams = dreams.filter(dream => dream.userId === currentUser.id);
export const publicDreams = dreams.filter(dream => dream.privacyLevel === 'public' || dream.privacyLevel === 'anonymous');
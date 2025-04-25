import React from 'react';
import { DreamMood } from '../../types';
import { 
  Smile, 
  Frown, 
  AlertTriangle, 
  HelpCircle, 
  Zap,
  Heart, 
  Cloud, 
  Sparkles 
} from 'lucide-react';

interface MoodBadgeProps {
  mood: DreamMood;
  size?: 'sm' | 'md' | 'lg';
}

const MoodBadge: React.FC<MoodBadgeProps> = ({ mood, size = 'md' }) => {
  const moodConfig: Record<DreamMood, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
    happy: { 
      icon: <Smile className="w-4 h-4" />, 
      color: 'text-yellow-600', 
      bgColor: 'bg-yellow-100', 
      label: 'Happy'
    },
    sad: { 
      icon: <Frown className="w-4 h-4" />, 
      color: 'text-blue-600', 
      bgColor: 'bg-blue-100', 
      label: 'Sad'
    },
    scary: { 
      icon: <AlertTriangle className="w-4 h-4" />, 
      color: 'text-red-600', 
      bgColor: 'bg-red-100', 
      label: 'Scary'
    },
    confusing: { 
      icon: <HelpCircle className="w-4 h-4" />, 
      color: 'text-purple-600', 
      bgColor: 'bg-purple-100', 
      label: 'Confusing'
    },
    exciting: { 
      icon: <Zap className="w-4 h-4" />, 
      color: 'text-amber-600', 
      bgColor: 'bg-amber-100', 
      label: 'Exciting'
    },
    peaceful: { 
      icon: <Heart className="w-4 h-4" />, 
      color: 'text-green-600', 
      bgColor: 'bg-green-100', 
      label: 'Peaceful'
    },
    anxious: { 
      icon: <Cloud className="w-4 h-4" />, 
      color: 'text-gray-600', 
      bgColor: 'bg-gray-100', 
      label: 'Anxious'
    },
    mysterious: { 
      icon: <Sparkles className="w-4 h-4" />, 
      color: 'text-indigo-600', 
      bgColor: 'bg-indigo-100', 
      label: 'Mysterious'
    }
  };

  const { icon, color, bgColor, label } = moodConfig[mood];
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };

  return (
    <span className={`inline-flex items-center rounded-full ${bgColor} ${color} ${sizeClasses[size]} gap-1 font-medium`}>
      {icon}
      {label}
    </span>
  );
};

export default MoodBadge;
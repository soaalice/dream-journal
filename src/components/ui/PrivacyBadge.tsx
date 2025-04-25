import React from 'react';
import { PrivacyLevel } from '../../types';
import { Globe, Lock, UserX } from 'lucide-react';

interface PrivacyBadgeProps {
  privacy: PrivacyLevel;
  size?: 'sm' | 'md' | 'lg';
}

const PrivacyBadge: React.FC<PrivacyBadgeProps> = ({ privacy, size = 'md' }) => {
  const privacyConfig: Record<PrivacyLevel, { icon: React.ReactNode; color: string; bgColor: string; label: string }> = {
    public: { 
      icon: <Globe className="w-4 h-4" />, 
      color: 'text-emerald-600', 
      bgColor: 'bg-emerald-100', 
      label: 'Public'
    },
    private: { 
      icon: <Lock className="w-4 h-4" />, 
      color: 'text-gray-600', 
      bgColor: 'bg-gray-100', 
      label: 'Private'
    },
    anonymous: { 
      icon: <UserX className="w-4 h-4" />, 
      color: 'text-slate-600', 
      bgColor: 'bg-slate-100', 
      label: 'Anonymous'
    }
  };

  const { icon, color, bgColor, label } = privacyConfig[privacy];
  
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

export default PrivacyBadge;
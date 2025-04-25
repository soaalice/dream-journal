import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useApp } from '../context/AppContext';
import { LoginCredentials, RegisterData } from '../types';
import { AlertTriangle } from 'lucide-react';
import EmojiAvatarPicker from '../components/EmojiAvatarPicker';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  avatarUrl: z.string().url('Invalid URL').or(z.string().length(0)),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const navigate = useNavigate();
  const { login, register, isDarkMode } = useApp();
  
  const { register: registerForm, handleSubmit: handleLoginSubmit, formState: { errors: loginErrors } } = 
    useForm<LoginCredentials>({
      resolver: zodResolver(loginSchema)
    });
    
  const { register: registerRegForm, handleSubmit: handleRegisterSubmit, formState: { errors: registerErrors }, setValue,
    watch } = 
    useForm<RegisterData>({
      resolver: zodResolver(registerSchema),
      defaultValues: {
        avatarUrl: '',
      }
    });

  const avatarUrl = watch('avatarUrl');
  
  const onLogin = async (data: LoginCredentials) => {
    try {
      await login(data);
      navigate('/');
    } catch (error) {
      console.error('Login failed:', error);
    }
  };
  
  const onRegister = async (data: RegisterData) => {
    try {
      await register(data);
      navigate('/');
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };
  
  return (
    <div className={`min-h-screen flex items-center justify-center px-4 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className={`max-w-md w-full space-y-8 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} p-8 rounded-lg shadow-lg`}>
        <div>
          <h2 className="text-3xl font-bold font-serif text-center mb-8">
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </h2>
        </div>
        
        {isLogin ? (
          <form className="space-y-6" onSubmit={handleLoginSubmit(onLogin)}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <input
                {...registerForm('email')}
                type="email"
                className={`
                  w-full px-4 py-2 rounded-md border
                  ${isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                  }
                  focus:outline-none focus:ring-2 focus:ring-purple-500
                `}
              />
              {loginErrors.email && (
                <p className="mt-1 text-red-500 text-sm flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  {loginErrors.email.message}
                </p>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <input
                {...registerForm('password')}
                type="password"
                className={`
                  w-full px-4 py-2 rounded-md border
                  ${isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                  }
                  focus:outline-none focus:ring-2 focus:ring-purple-500
                `}
              />
              {loginErrors.password && (
                <p className="mt-1 text-red-500 text-sm flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  {loginErrors.password.message}
                </p>
              )}
            </div>
            
            <button
              type="submit"
              className="w-full py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
            >
              Sign In
            </button>
          </form>
        ) : (
          <form className="space-y-6" onSubmit={handleRegisterSubmit(onRegister)}>
              <div>
                <label htmlFor="avatarUrl" className="block text-sm font-medium mb-1">
                  Profile Picture
                </label>
                <EmojiAvatarPicker
                  initialAvatarUrl={avatarUrl}
                  onAvatarChange={(url) => setValue('avatarUrl', url)}
                  isDarkMode={isDarkMode}
                />
                {registerErrors.avatarUrl && (
                  <p className="mt-1 text-red-500 text-sm flex items-center">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    {registerErrors.avatarUrl.message}
                  </p>
                )}
              </div>
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Name
              </label>
              <input
                {...registerRegForm('name')}
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
              {registerErrors.name && (
                <p className="mt-1 text-red-500 text-sm flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  {registerErrors.name.message}
                </p>
              )}
            </div>
            
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <input
                {...registerRegForm('email')}
                type="email"
                className={`
                  w-full px-4 py-2 rounded-md border
                  ${isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                  }
                  focus:outline-none focus:ring-2 focus:ring-purple-500
                `}
              />
              {registerErrors.email && (
                <p className="mt-1 text-red-500 text-sm flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  {registerErrors.email.message}
                </p>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Password
              </label>
              <input
                {...registerRegForm('password')}
                type="password"
                className={`
                  w-full px-4 py-2 rounded-md border
                  ${isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                  }
                  focus:outline-none focus:ring-2 focus:ring-purple-500
                `}
              />
              {registerErrors.password && (
                <p className="mt-1 text-red-500 text-sm flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  {registerErrors.password.message}
                </p>
              )}
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
                Confirm Password
              </label>
              <input
                {...registerRegForm('confirmPassword')}
                type="password"
                className={`
                  w-full px-4 py-2 rounded-md border
                  ${isDarkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                  }
                  focus:outline-none focus:ring-2 focus:ring-purple-500
                `}
              />
              {registerErrors.confirmPassword && (
                <p className="mt-1 text-red-500 text-sm flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1" />
                  {registerErrors.confirmPassword.message}
                </p>
              )}
            </div>
            
            <button
              type="submit"
              className="w-full py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors duration-200"
            >
              Create Account
            </button>
          </form>
        )}
        
        <div className="mt-4 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-purple-600 hover:text-purple-700 transition-colors duration-200"
          >
            {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
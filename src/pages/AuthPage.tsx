import React from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Check, Circle, Moon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { LoginCredentials, RegisterData } from '../types';
import EmojiAvatarPicker from '../components/EmojiAvatarPicker';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Field, Input, PasswordInput } from '../components/ui/Field';
import { useToast } from '../components/ui/Toast';

const loginSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password')
});

const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(50, 'Name must be at most 50 characters'),
    email: z.string().email('Enter a valid email address'),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .max(72, 'At most 72 characters')
      .regex(/[A-Za-z]/, 'Include a letter')
      .regex(/\d/, 'Include a number'),
    confirmPassword: z.string(),
    avatarUrl: z.string().url('Invalid URL').or(z.string().length(0))
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword']
  });

/** Live checklist so people see what is still missing while typing. */
const PasswordRules: React.FC<{ value: string }> = ({ value }) => {
  const rules = [
    { ok: value.length >= 8 && value.length <= 72, label: '8-72 characters' },
    { ok: /[A-Za-z]/.test(value), label: 'A letter' },
    { ok: /\d/.test(value), label: 'A number' }
  ];
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Password requirements">
      {rules.map((r) => (
        <li key={r.label} className={`flex items-center gap-1 ${r.ok ? 'text-success' : 'text-muted'}`}>
          {r.ok ? <Check className="h-4 w-4" aria-hidden /> : <Circle className="h-3 w-3" aria-hidden />}
          {r.label}
          <span className="sr-only">{r.ok ? ' (met)' : ' (not met)'}</span>
        </li>
      ))}
    </ul>
  );
};

const LoginForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { login } = useAuth();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<LoginCredentials>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginCredentials) => {
    try {
      await login(data);
      toast.success('Welcome back!');
      onDone();
    } catch (error) {
      setError('root', { message: error instanceof Error ? error.message : 'Login failed' });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <Field label="Email" error={errors.email?.message}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} type="email" autoComplete="email" {...register('email')} />
        )}
      </Field>
      <Field label="Password" error={errors.password?.message}>
        {({ id, describedBy, invalid }) => (
          <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="current-password" {...register('password')} />
        )}
      </Field>
      {errors.root && (
        <p role="alert" className="text-danger-text">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
        Sign in
      </Button>
    </form>
  );
};

const RegisterForm: React.FC<{ onDone: () => void }> = ({ onDone }) => {
  const { register: signUp } = useAuth();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<RegisterData>({ resolver: zodResolver(registerSchema), defaultValues: { avatarUrl: '' } });

  const password = watch('password') ?? '';

  const onSubmit = async (data: RegisterData) => {
    try {
      await signUp(data);
      toast.success('Account created. Welcome to Dream Journal!');
      onDone();
    } catch (error) {
      setError('root', { message: error instanceof Error ? error.message : 'Registration failed' });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div>
        <p className="mb-2 text-sm font-medium">Profile picture</p>
        <EmojiAvatarPicker initialAvatarUrl={watch('avatarUrl')} onAvatarChange={(url) => setValue('avatarUrl', url)} />
      </div>
      <Field label="Name" error={errors.name?.message}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="name" {...register('name')} />
        )}
      </Field>
      <Field label="Email" error={errors.email?.message}>
        {({ id, describedBy, invalid }) => (
          <Input id={id} aria-describedby={describedBy} invalid={invalid} type="email" autoComplete="email" {...register('email')} />
        )}
      </Field>
      <div>
        <Field label="Password">
          {({ id, invalid }) => (
            <PasswordInput id={id} invalid={invalid} autoComplete="new-password" {...register('password')} />
          )}
        </Field>
        <PasswordRules value={password} />
      </div>
      <Field label="Confirm password" error={errors.confirmPassword?.message}>
        {({ id, describedBy, invalid }) => (
          <PasswordInput id={id} aria-describedby={describedBy} invalid={invalid} autoComplete="new-password" {...register('confirmPassword')} />
        )}
      </Field>
      {errors.root && (
        <p role="alert" className="text-danger-text">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" loading={isSubmitting} className="w-full" size="lg">
        Create account
      </Button>
    </form>
  );
};

const AuthPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, notice } = useAuth();

  const isLogin = params.get('register') !== 'true';
  useDocumentTitle(isLogin ? 'Sign in' : 'Create account');

  // Send people back to where they were heading before being asked to sign in.
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const goBack = () => navigate(from, { replace: true });

  if (isAuthenticated) return <Navigate to={from} replace />;

  return (
    <div className="mx-auto grid max-w-4xl items-start gap-8 md:grid-cols-2 md:pt-6">
      <div className="hidden md:block">
        <Moon className="mb-4 h-10 w-10 text-accent-text" aria-hidden />
        <h2 className="mb-3 font-serif text-3xl font-bold">Remember more. Share what you want.</h2>
        <ul className="space-y-3 text-muted">
          <li>Keep a private journal of your dreams.</li>
          <li>Share some publicly, or anonymously.</li>
          <li>Find patterns with moods and tags.</li>
        </ul>
      </div>

      <Card>
        <h1 className="mb-6 text-center font-serif text-3xl font-bold">{isLogin ? 'Welcome back' : 'Create account'}</h1>
        {notice && (
          <p role="alert" className="mb-4 rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger-text">
            {notice}
          </p>
        )}
        {isLogin ? <LoginForm onDone={goBack} /> : <RegisterForm onDone={goBack} />}
        <p className="mt-6 text-center text-sm text-muted">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => setParams(isLogin ? { register: 'true' } : {}, { replace: true })}
            className="font-medium text-accent-text hover:underline"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </Card>
    </div>
  );
};

export default AuthPage;

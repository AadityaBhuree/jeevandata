'use client';
import { TitleSetter } from '@/components/ui/title-setter';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, ApiError } from '@/services/api';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DarkModeToggle } from '@/components/ui/dark-mode-toggle';
import { logger } from '@/lib/logger';
import { ArrowRight, Sparkles, ShieldCheck, HeartPulse } from 'lucide-react';

interface FormErrors {
  email?: string;
  password?: string;
  form?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Already logged in → straight to the dashboard
  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  function validate(): boolean {
    const next: FormErrors = {};
    if (!EMAIL_RE.test(email.trim())) {
      next.email = 'Enter a valid email address';
    }
    if (password.length < 8) {
      next.password = 'Password must be at least 8 characters';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});

    try {
      const res = await authApi.login({ email: email.trim(), password });
      setSession(
        {
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          expiresIn: res.expiresIn,
        },
        res.user,
      );
      logger.info('User logged in', { email: res.user.email, role: res.user.role });
      router.push('/dashboard');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Login failed. Please try again.';
      setErrors({ form: message });
      logger.error('Login failed', err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="via-jeevandata-50 dark:via-jeevandata-950 relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <TitleSetter title="Staff Sign In" />
      {/* ─── Animated background ─────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float bg-jeevandata-200/30 dark:bg-jeevandata-900/20 absolute -left-32 -top-32 h-96 w-96 rounded-full blur-3xl" />
        <div
          className="animate-float absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-emerald-200/20 blur-3xl dark:bg-emerald-900/20"
          style={{ animationDelay: '1.5s' }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="from-jeevandata-500 to-jeevandata-700 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm">
            <HeartPulse className="h-5 w-5 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Jeevandata</span>
        </Link>
        <DarkModeToggle />
      </header>

      {/* Login Card */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          <div className="animate-fade-in-up shadow-soft rounded-2xl border border-slate-200/60 bg-white/70 p-8 backdrop-blur-xl dark:border-slate-700/50 dark:bg-slate-900/50">
            <div className="mb-6 text-center">
              <span className="border-jeevandata-200 bg-jeevandata-50 text-jeevandata-700 dark:border-jeevandata-800 dark:bg-jeevandata-900/50 dark:text-jeevandata-300 mb-4 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
                <Sparkles className="h-3 w-3" />
                Clinic Staff Sign In
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                Welcome back
              </h1>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Sign in to manage patient intake & clinical briefs
              </p>
            </div>

            {errors.form && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/30 dark:text-red-400"
              >
                {errors.form}
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <Input
                id="login-email"
                type="email"
                label="Email address"
                placeholder="doctor@jeevandata.com"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
              />

              <Input
                id="login-password"
                type="password"
                label="Password"
                placeholder="••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
              />

              <Button
                type="submit"
                variant="jeevandata"
                size="lg"
                className="shadow-glow hover:shadow-glow-lg w-full"
                loading={submitting}
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                {submitting ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure session · tokens rotated automatically
            </div>
          </div>

          <p className="animate-fade-in mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Not a staff member?{' '}
            <Link
              href="/"
              className="text-jeevandata-600 dark:text-jeevandata-400 font-medium hover:underline"
            >
              Start a patient intake session
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

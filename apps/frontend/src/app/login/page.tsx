'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authApi, ApiError } from '@/services/api';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DarkModeToggle } from '@/components/ui/dark-mode-toggle';
import { logger } from '@/lib/logger';
import {
  ArrowRight,
  Sparkles,
  ShieldCheck,
  HeartPulse,
  CheckCircle2,
  MessageSquareText,
  ClipboardList,
  Camera,
} from 'lucide-react';

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
        { accessToken: res.accessToken, refreshToken: res.refreshToken, expiresIn: res.expiresIn },
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
    <div className="via-jeevandata-50 dark:via-jeevandata-950 relative flex min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-float bg-jeevandata-200/30 dark:bg-jeevandata-900/20 absolute -left-32 -top-32 h-96 w-96 rounded-full blur-3xl" />
        <div
          className="animate-float absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-emerald-200/20 blur-3xl dark:bg-emerald-900/20"
          style={{ animationDelay: '1.5s' }}
        />
      </div>

      <div className="from-jeevandata-600 to-jeevandata-900 relative z-10 hidden w-1/2 flex-col items-center justify-center bg-gradient-to-br p-12 lg:flex">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 backdrop-blur-sm">
            <HeartPulse className="h-10 w-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white">Jeevandata</h2>
          <p className="text-jeevandata-200 mt-2 text-sm">AI-powered smart clinic intake system</p>
          <div className="mt-8 space-y-4 text-left">
            {[
              { icon: Camera, text: 'Face recognition check-in' },
              { icon: MessageSquareText, text: 'AI voice symptom intake' },
              { icon: ClipboardList, text: 'Instant clinical briefs' },
            ].map((item) => (
              <div key={item.text} className="flex items-center gap-3">
                <CheckCircle2 className="text-jeevandata-300 h-4 w-4 flex-shrink-0" />
                <span className="text-jeevandata-100 text-sm">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <header className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-6 py-4 md:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="from-jeevandata-500 to-jeevandata-700 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br shadow-sm">
            <HeartPulse className="h-5 w-5 text-white" />
          </div>
          <span className="text-sm font-semibold text-slate-900 dark:text-white">Jeevandata</span>
        </Link>
        <DarkModeToggle />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-16 pt-20 md:px-8 md:pt-0">
        <div className="w-full max-w-md">
          <div className="mb-6 hidden justify-end md:flex">
            <DarkModeToggle />
          </div>
          <div className="animate-fade-in-up shadow-card-elevated rounded-3xl border border-slate-200/80 bg-white/80 p-8 backdrop-blur-xl sm:p-10 dark:border-slate-800/80 dark:bg-slate-900/80">
            <div className="mb-6 text-center">
              <span className="border-jeevandata-200 bg-jeevandata-50 text-jeevandata-700 dark:border-jeevandata-800 dark:bg-jeevandata-900/50 dark:text-jeevandata-300 shadow-2xs mb-4 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-semibold">
                <Sparkles className="h-3 w-3" />
                Clinic Staff Sign In
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
                Welcome back
              </h1>
              <p className="mt-1.5 text-xs text-slate-500 sm:text-sm dark:text-slate-400">
                Sign in to manage patient intake &amp; clinical briefs
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
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  Demo auto-fill:
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('doctor@jeevandata.com');
                      setPassword('Password123!');
                    }}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Doctor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin@jeevandata.com');
                      setPassword('Password123!');
                    }}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('reception@jeevandata.com');
                      setPassword('Password123!');
                    }}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Reception
                  </button>
                </div>
              </div>
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
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
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

'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/stores/auth-store';
import { hasRole } from '@/lib/roles';
import type { UserRole } from '@jeevandata/shared-types';

interface RequireAuthProps {
  children: ReactNode;
  /** Optional — redirect here instead of /login when unauthenticated. */
  redirectTo?: string;
  /**
   * When provided, the current user's role must be in this set (fail-closed:
   * a session with any other role is denied). Leave undefined to allow any
   * authenticated user.
   */
  allowedRoles?: readonly UserRole[];
  /**
   * Optional — when set, denied users are redirected here instead of seeing
   * the access-denied screen. Point this at a route the user IS allowed to
   * access, otherwise the redirect could loop.
   */
  deniedRedirectTo?: string;
}

/**
 * Guards a client subtree behind an active session and (optionally) a role.
 * While the persisted session is being restored it renders a minimal loading
 * placeholder; unauthenticated users are redirected (fail-closed) to /login
 * (or `redirectTo`); authenticated users whose role is not in `allowedRoles`
 * see an access-denied view or are redirected to `deniedRedirectTo`.
 */
export function RequireAuth({
  children,
  redirectTo = '/login',
  allowedRoles,
  deniedRedirectTo,
}: RequireAuthProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.user?.role);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  const roleAllowed = !allowedRoles || hasRole(role, allowedRoles);
  const denied = isAuthenticated && !roleAllowed;

  useEffect(() => {
    // Never redirect before the persisted session has rehydrated: during the
    // SSR→client hydration window the store briefly reads as unauthenticated,
    // and redirecting then would bounce every page refresh through /login.
    if (!hasHydrated) return;
    if (!isAuthenticated) {
      router.replace(redirectTo);
      return;
    }
    if (denied && deniedRedirectTo) {
      router.replace(deniedRedirectTo);
    }
  }, [hasHydrated, isAuthenticated, denied, deniedRedirectTo, redirectTo, router]);

  if (!hasHydrated || !isAuthenticated) {
    return (
      <div
        role="status"
        aria-label="Checking session"
        className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950"
      >
        <div className="border-jeevandata-200 border-t-jeevandata-500 h-8 w-8 animate-spin rounded-full border-2" />
      </div>
    );
  }

  if (denied) {
    return (
      <div
        role="alert"
        aria-label="Access denied"
        className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950"
      >
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <ShieldAlert className="h-8 w-8 text-red-600 dark:text-red-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Access denied
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Your account doesn&apos;t have permission to view this page.
          </p>
          <Link
            href="/"
            className="bg-jeevandata-500 hover:bg-jeevandata-600 mt-6 inline-flex items-center rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors"
          >
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

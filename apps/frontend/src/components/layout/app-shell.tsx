'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { Brand } from '@/components/ui/brand';
import { DarkModeToggle } from '@/components/ui/dark-mode-toggle';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS, hasRole } from '@/lib/roles';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@jeevandata/shared-types';
import { authApi } from '@/services/api';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  roles?: UserRole[];
}

const MAIN_NAV: NavItem[] = [{ label: 'Dashboard', href: '/dashboard' }];

const ADMIN_NAV: NavItem[] = [
  { label: 'Analytics', href: '/admin', roles: [UserRole.ADMIN, UserRole.SYSTEM] },
  { label: 'Audit Log', href: '/admin/audit', roles: [UserRole.ADMIN, UserRole.SYSTEM] },
  { label: 'Health', href: '/admin/health', roles: [UserRole.ADMIN, UserRole.SYSTEM] },
  { label: 'Clinics', href: '/clinics', roles: [UserRole.ADMIN, UserRole.SYSTEM] },
  { label: 'API Keys', href: '/api-keys', roles: [UserRole.ADMIN, UserRole.SYSTEM] },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

/**
 * Authenticated app shell — shared header + sidebar for the staff area.
 * Replaces the ad-hoc per-page headers on the dashboard and admin pages.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const { user, logout } = useAuth();

  const visibleMain = MAIN_NAV.filter((n) => !n.roles || hasRole(user?.role, n.roles));
  const visibleAdmin = ADMIN_NAV.filter((n) => !n.roles || hasRole(user?.role, n.roles));
  const isAdminArea =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/clinics') ||
    pathname.startsWith('/api-keys');

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-slate-200 bg-white md:flex dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-100 px-4 py-4 dark:border-slate-800">
          <Brand />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Main navigation">
          <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Overview
          </p>
          {visibleMain.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              className={cn(
                'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive(pathname, item.href)
                  ? 'bg-jeevandata-50 text-jeevandata-700 dark:bg-jeevandata-900/30 dark:text-jeevandata-300'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
              )}
            >
              {item.label}
            </Link>
          ))}

          {visibleAdmin.length > 0 && (
            <>
              <p className="px-2 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Admin
              </p>
              {visibleAdmin.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                  className={cn(
                    'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive(pathname, item.href)
                      ? 'bg-jeevandata-50 text-jeevandata-700 dark:bg-jeevandata-900/30 dark:text-jeevandata-300'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </nav>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            {/* Mobile brand */}
            <div className="md:hidden">
              <Brand compact />
            </div>
            <div className="hidden md:block">
              <h1 className="text-sm font-semibold text-slate-900 dark:text-white">
                {isAdminArea ? 'Admin Console' : 'Doctor Dashboard'}
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <DarkModeToggle />
              {user && (
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800">
                  <div className="bg-jeevandata-500 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white">
                    {user.name
                      ?.split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <span className="max-w-[120px] truncate text-xs font-medium text-slate-700 dark:text-slate-300">
                    {user.name}
                  </span>
                  <Badge variant="info" size="sm">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => {
                      authApi.logout().catch(() => {});
                      logout();
                    }}
                    className="text-slate-400 transition-colors hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400"
                    aria-label="Sign out"
                    title="Sign out"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Brand } from '@/components/ui/brand';
import { DarkModeToggle } from '@/components/ui/dark-mode-toggle';
import { useAuth } from '@/hooks/useAuth';
import { ROLE_LABELS, hasRole } from '@/lib/roles';
import { Badge } from '@/components/ui/badge';
import { UserRole } from '@jeevandata/shared-types';
import { authApi } from '@/services/api';
import {
  LogOut,
  Users,
  Menu,
  X,
  LayoutDashboard,
  BarChart3,
  Shield,
  HeartPulse,
  Server,
  KeyRound,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  roles?: UserRole[];
  icon?: React.ComponentType<{ className?: string }>;
}

const MAIN_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Queue', href: '/queue', icon: Users },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Analytics', href: '/admin', roles: [UserRole.ADMIN, UserRole.SYSTEM], icon: BarChart3 },
  {
    label: 'Audit Log',
    href: '/admin/audit',
    roles: [UserRole.ADMIN, UserRole.SYSTEM],
    icon: Shield,
  },
  {
    label: 'Health',
    href: '/admin/health',
    roles: [UserRole.ADMIN, UserRole.SYSTEM],
    icon: HeartPulse,
  },
  { label: 'Clinics', href: '/clinics', roles: [UserRole.ADMIN, UserRole.SYSTEM], icon: Server },
  {
    label: 'API Keys',
    href: '/api-keys',
    roles: [UserRole.ADMIN, UserRole.SYSTEM],
    icon: KeyRound,
  },
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
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) setMobileOpen(false);
    },
    [mobileOpen],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className="bg-radial-mesh flex min-h-screen bg-slate-50/70 dark:bg-slate-950">
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-slate-200/80 bg-white/90 backdrop-blur-xl md:flex dark:border-slate-800/80 dark:bg-slate-900/90">
        <div className="border-b border-slate-100/80 px-5 py-4 dark:border-slate-800/80">
          <Brand />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Main navigation">
          <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Overview
          </p>
          {visibleMain.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-jeevandata-50 text-jeevandata-700 dark:bg-jeevandata-900/30 dark:text-jeevandata-300 shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
                )}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      'h-4 w-4 flex-shrink-0 transition-colors',
                      active
                        ? 'text-jeevandata-600 dark:text-jeevandata-400'
                        : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300',
                    )}
                  />
                )}
                <span>{item.label}</span>
              </Link>
            );
          })}

          {visibleAdmin.length > 0 && (
            <>
              <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Management
              </p>
              {visibleAdmin.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                      active
                        ? 'bg-jeevandata-50 text-jeevandata-700 dark:bg-jeevandata-900/30 dark:text-jeevandata-300 shadow-sm'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
                    )}
                  >
                    {Icon && (
                      <Icon
                        className={cn(
                          'h-4 w-4 flex-shrink-0 transition-colors',
                          active
                            ? 'text-jeevandata-600 dark:text-jeevandata-400'
                            : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300',
                        )}
                      />
                    )}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* Pinned Bottom CTA & Version */}
        <div className="border-t border-slate-100 p-3 dark:border-slate-800">
          <Link
            href="/"
            className="bg-jeevandata-500 hover:bg-jeevandata-600 flex w-full items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition-all duration-150 hover:shadow active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" /> Start New Intake
          </Link>
          <p className="mt-2.5 text-center text-[10px] text-slate-400 dark:text-slate-600">
            Jeevandata Smart Clinic · v1.0
          </p>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white shadow-2xl md:hidden dark:border-slate-800 dark:bg-slate-900"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <Brand compact />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Mobile navigation">
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Overview
              </p>
              {visibleMain.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-jeevandata-50 text-jeevandata-700 dark:bg-jeevandata-900/30 dark:text-jeevandata-300'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
                    )}
                  >
                    {Icon && (
                      <Icon
                        className={cn(
                          'h-4 w-4',
                          active
                            ? 'text-jeevandata-600 dark:text-jeevandata-400'
                            : 'text-slate-400 dark:text-slate-500',
                        )}
                      />
                    )}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              {visibleAdmin.length > 0 && (
                <>
                  <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Management
                  </p>
                  {visibleAdmin.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          active
                            ? 'bg-jeevandata-50 text-jeevandata-700 dark:bg-jeevandata-900/30 dark:text-jeevandata-300'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200',
                        )}
                      >
                        {Icon && (
                          <Icon
                            className={cn(
                              'h-4 w-4',
                              active
                                ? 'text-jeevandata-600 dark:text-jeevandata-400'
                                : 'text-slate-400 dark:text-slate-500',
                            )}
                          />
                        )}
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </>
              )}
            </nav>

            <div className="border-t border-slate-100 p-3 dark:border-slate-800">
              <Link
                href="/"
                className="bg-jeevandata-500 hover:bg-jeevandata-600 flex w-full items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors"
              >
                <Plus className="h-4 w-4" /> Start New Intake
              </Link>
            </div>
          </aside>
        </>
      )}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            {/* Hamburger for mobile */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 md:hidden dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Open navigation menu"
              aria-expanded={mobileOpen}
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Mobile brand */}
            <div className="md:hidden">
              <Brand compact />
            </div>
            <div className="hidden md:flex md:items-center md:gap-2">
              <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                Workspace
              </span>
              <span className="text-slate-300 dark:text-slate-700">/</span>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                {isAdminArea ? 'Admin Console' : 'Doctor Dashboard'}
              </h2>
            </div>

            <div className="flex items-center gap-2.5">
              <DarkModeToggle />
              {user && (
                <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 py-1 pl-1 pr-2.5 shadow-sm dark:border-slate-700/80 dark:bg-slate-800/90">
                  <div className="from-jeevandata-500 to-jeevandata-700 shadow-xs flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white">
                    {user.name
                      ?.split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')}
                  </div>
                  <span className="max-w-[120px] truncate text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {user.name}
                  </span>
                  <Badge variant="outline-info" size="sm">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => {
                      authApi.logout().catch(() => {});
                      logout();
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                    aria-label="Sign out"
                    title="Sign out"
                  >
                    <LogOut className="h-3.5 w-3.5" />
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

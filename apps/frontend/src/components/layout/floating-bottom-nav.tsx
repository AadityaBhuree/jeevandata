'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Apple, Mic, ClipboardList } from 'lucide-react';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  badge?: string | number;
}

export interface FloatingBottomNavProps {
  items?: NavItem[];
  className?: string;
}

const defaultNavItems: NavItem[] = [
  {
    label: 'Home',
    href: '/patient',
    icon: <Home className="h-5 w-5" />,
  },
  {
    label: 'Diet',
    href: '/patient#diet',
    icon: <Apple className="h-5 w-5" />,
  },
  {
    label: 'Intake',
    href: '/intake',
    icon: <Mic className="h-5 w-5" />,
    badge: 'AI',
  },
  {
    label: 'Visits',
    href: '/patient#history',
    icon: <ClipboardList className="h-5 w-5" />,
  },
];

export function FloatingBottomNav({ items = defaultNavItems, className }: FloatingBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Mobile Navigation" className={cn('floating-bottom-bar sm:hidden', className)}>
      <ul className="flex items-center justify-around">
        {items.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/patient' && pathname.startsWith(item.href));

          return (
            <li key={item.label} className="relative">
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 rounded-xl px-3.5 py-1.5 transition-all duration-150 active:scale-95',
                  isActive
                    ? 'font-bold text-sky-600 dark:text-sky-400'
                    : 'font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100',
                )}
              >
                <div className="relative">
                  {item.icon}
                  {item.badge && (
                    <span className="shadow-xs absolute -right-2 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-emerald-500 px-1 text-[9px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-tight">{item.label}</span>
                {isActive && (
                  <span className="absolute -bottom-1 h-1 w-4 rounded-full bg-sky-500 dark:bg-sky-400" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

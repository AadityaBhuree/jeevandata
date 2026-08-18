'use client';

import { useTheme } from './theme-provider';
import { Button } from './button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu';
import { Sun, Moon, Monitor, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const themeOptions = [
  {
    value: 'light' as const,
    label: 'Light',
    icon: Sun,
  },
  {
    value: 'dark' as const,
    label: 'Dark',
    icon: Moon,
  },
  {
    value: 'system' as const,
    label: 'System',
    icon: Monitor,
  },
];

export function DarkModeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const Icon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-11 w-11 rounded-full"
          aria-label="Toggle theme"
        >
          <Icon className="h-5 w-5 transition-all" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {themeOptions.map(({ value, label, icon: OptionIcon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              'flex items-center justify-between gap-3',
              theme === value && 'text-jeevandata-600 font-medium',
            )}
          >
            <span className="flex items-center gap-2">
              <OptionIcon className="h-4 w-4" />
              {label}
            </span>
            {theme === value && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

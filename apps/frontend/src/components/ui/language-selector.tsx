'use client';

import { useState, useRef, useEffect, useCallback, useId } from 'react';
import type { SupportedLocale } from '@/i18n';
import { cn } from '@/lib/utils';
import { Languages } from 'lucide-react';

interface LanguageSelectorProps {
  currentLocale: SupportedLocale;
  onLocaleChange: (locale: SupportedLocale) => void;
  className?: string;
  compact?: boolean;
}

const LOCALES: Array<{ code: SupportedLocale; label: string; native: string; flag: string }> = [
  { code: 'en', label: 'English', native: 'English', flag: '🇬🇧' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', flag: '🇮🇳' },
  { code: 'es', label: 'Spanish', native: 'Español', flag: '🇪🇸' },
];

export function LanguageSelector({
  currentLocale,
  onLocaleChange,
  className,
  compact = false,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const menuId = useId();

  const currentIndex = Math.max(
    0,
    LOCALES.findIndex((l) => l.code === currentLocale),
  );

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const openMenu = useCallback((indexToFocus = 0) => {
    setIsOpen(true);
    setActiveIndex(indexToFocus);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Focus the active item once the menu has rendered (runs after commit)
  useEffect(() => {
    if (isOpen) {
      itemRefs.current[activeIndex]?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleSelect(code: SupportedLocale) {
    onLocaleChange(code);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openMenu(0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      openMenu(LOCALES.length - 1);
    }
  }

  function handleMenuKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        closeMenu();
        break;
      case 'ArrowDown': {
        e.preventDefault();
        const next = (activeIndex + 1) % LOCALES.length;
        setActiveIndex(next);
        itemRefs.current[next]?.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = (activeIndex - 1 + LOCALES.length) % LOCALES.length;
        setActiveIndex(prev);
        itemRefs.current[prev]?.focus();
        break;
      }
      case 'Home':
        e.preventDefault();
        setActiveIndex(0);
        itemRefs.current[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        setActiveIndex(LOCALES.length - 1);
        itemRefs.current[LOCALES.length - 1]?.focus();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  }

  const current = LOCALES[currentIndex] ?? LOCALES[0]!;

  const triggerClass = compact
    ? 'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
    : 'flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700';

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu(0))}
        onKeyDown={handleTriggerKeyDown}
        className={triggerClass}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        aria-label={`Select language, current: ${current.label}`}
        title={current.label}
      >
        <Languages className="h-3.5 w-3.5" aria-hidden="true" />
        {compact ? (
          <span className="hidden sm:inline">{current.flag}</span>
        ) : (
          <>
            <span>{current.flag}</span>
            <span>{current.native}</span>
          </>
        )}
      </button>

      {isOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="Available languages"
          onKeyDown={handleMenuKeyDown}
          className={cn(
            'absolute right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900',
            compact ? 'w-40' : 'w-48',
          )}
        >
          {LOCALES.map((locale, i) => (
            <button
              key={locale.code}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              role="menuitemradio"
              aria-checked={locale.code === currentLocale}
              onClick={() => handleSelect(locale.code)}
              onMouseEnter={() => setActiveIndex(i)}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left transition-colors',
                compact ? 'text-xs' : 'gap-3 px-4 py-2.5 text-sm',
                locale.code === currentLocale
                  ? 'bg-jeevandata-50 text-jeevandata-700 dark:bg-jeevandata-900/30 dark:text-jeevandata-300'
                  : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800',
              )}
            >
              <span aria-hidden="true" className={compact ? 'text-base' : 'text-lg'}>
                {locale.flag}
              </span>
              <div>
                <p className="font-medium">{locale.native}</p>
                {!compact && <p className="text-[10px] text-slate-400">{locale.label}</p>}
              </div>
              {locale.code === currentLocale && (
                <span
                  aria-hidden="true"
                  className="bg-jeevandata-500 ml-auto h-2 w-2 rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

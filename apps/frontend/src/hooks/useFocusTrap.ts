'use client';

import { useEffect, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  'iframe',
].join(',');

/**
 * Traps keyboard focus inside the returned container ref while `active` is
 * true, and restores focus to the previously-focused element on deactivate.
 *
 * @example
 * const trapRef = useFocusTrap<HTMLDivElement>(isOpen);
 * return <div ref={trapRef} role="dialog" aria-modal="true">...</div>;
 */
export /**
 * Layout-based visibility signals (getClientRects / offsetParent) are
 * unreliable in jsdom (used by Vitest) since it performs no layout, so we
 * rely on computed styles + connectivity instead, which work in both.
 */
function isVisible(el: HTMLElement): boolean {
  if (el === document.activeElement) return true;
  if (!el.isConnected) return false;
  const style = window.getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

export function useFocusTrap<T extends HTMLElement = HTMLElement>(active: boolean) {
  const containerRef = useRef<T | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    if (!active) return;

    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    function getFocusable(): HTMLElement[] {
      const root = containerRef.current;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((el) =>
        isVisible(el),
      );
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      if (!activeRef.current) return;

      const root = containerRef.current;
      if (!root) return;

      const focusables = getFocusable();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;

      if (e.shiftKey) {
        if (activeEl === first || !root.contains(activeEl)) {
          e.preventDefault();
          last.focus();
        }
      } else if (activeEl === last || !root.contains(activeEl)) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);

    // Move focus inside the trap (first focusable element, falling back to
    // the container itself which is focusable via tabIndex=-1).
    let fallbackTabindex = false;
    const first = getFocusable()[0];
    if (first) {
      first.focus();
    } else {
      container.setAttribute('tabindex', '-1');
      fallbackTabindex = true;
      container.focus();
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      // Only remove the attribute if we set it, so we never clobber a
      // pre-existing tabindex on the container.
      if (fallbackTabindex) container.removeAttribute('tabindex');
      previouslyFocused?.focus?.();
    };
  }, [active]);

  return containerRef;
}

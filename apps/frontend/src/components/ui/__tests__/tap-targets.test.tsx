import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../button';
import { DarkModeToggle } from '../dark-mode-toggle';
import { LanguageSelector } from '../language-selector';

vi.mock('@/components/ui/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useTheme: () => ({ theme: 'light', setTheme: vi.fn(), resolvedTheme: 'light' }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
}));

/**
 * WCAG 2.5.8 requires interactive elements to be at least 44×44 CSS px.
 * In jsdom, getBoundingClientRect() returns 0×0, so we verify via CSS
 * classes instead. These Tailwind classes guarantee ≥44px:
 *   h-11 (44), h-12 (48), w-11 (44), w-12 (48),
 *   min-h-11 (≥44), min-w-11 (≥44)
 * Full-width elements (flex-1, w-full) get width from their parent,
 * so we only need to verify height.
 */

function getInteractiveElements(container: HTMLElement) {
  const selector = 'button, a[href], [role="button"], [role="menuitem"], [role="menuitemradio"]';
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter((el) => {
    if (el.classList.contains('sr-only')) return false;
    if (el.closest('.sr-only')) return false;
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return true;
  });
}

function label(el: HTMLElement): string {
  return (
    el.getAttribute('aria-label') ||
    el.getAttribute('title') ||
    el.textContent?.trim().slice(0, 40) ||
    el.tagName
  );
}

describe('WCAG 2.5.8 — Tap target sizes', () => {
  describe('Button component', () => {
    it('default button has h-10 (40px) — meets minimum', () => {
      const { container } = render(<Button>Click me</Button>);
      const btns = getInteractiveElements(container);
      expect(btns.length).toBeGreaterThan(0);
      for (const b of btns) {
        expect(b.className, `Button "${label(b)}"`).toMatch(/h-10|h-11|h-12/);
      }
    });

    it('sm button has adequate height class', () => {
      const { container } = render(<Button size="sm">Small</Button>);
      const btns = getInteractiveElements(container);
      for (const b of btns) {
        expect(b.className, `Button "${label(b)}"`).toMatch(/h-9|h-10|h-11|h-12/);
      }
    });

    it('icon button has w-10 h-10 (40×40)', () => {
      const { container } = render(
        <Button size="icon" aria-label="Icon">
          <span>★</span>
        </Button>,
      );
      const btns = getInteractiveElements(container);
      for (const b of btns) {
        expect(b.className, `Button "${label(b)}"`).toMatch(
          /w-10.*h-10|h-10.*w-10|w-11|h-11|w-12|h-12/,
        );
      }
    });

    it('icon-md button has w-11 h-11 (44×44)', () => {
      const { container } = render(
        <Button size="icon-md" aria-label="Medium icon">
          <span>★</span>
        </Button>,
      );
      const btns = getInteractiveElements(container);
      for (const b of btns) {
        expect(b.className, `Button "${label(b)}"`).toMatch(/w-11|h-11|w-12|h-12/);
      }
    });

    it('lg button has h-11 (44px)', () => {
      const { container } = render(<Button size="lg">Large</Button>);
      const btns = getInteractiveElements(container);
      for (const b of btns) {
        expect(b.className, `Button "${label(b)}"`).toMatch(/h-11|h-12/);
      }
    });
  });

  describe('DarkModeToggle', () => {
    it('trigger has h-11 w-11 (44×44)', () => {
      const { container } = render(<DarkModeToggle />);
      const btns = getInteractiveElements(container);
      expect(btns.length).toBeGreaterThan(0);
      for (const b of btns) {
        expect(b.className, `DarkModeToggle "${label(b)}"`).toMatch(/h-11.*w-11|w-11.*h-11/);
      }
    });

    it('dropdown menu items have adequate height class', async () => {
      const user = userEvent.setup();
      render(<DarkModeToggle />);
      await user.click(screen.getByRole('button', { name: /toggle theme/i }));
      // Radix renders menu items in a portal
      const items = document.body.querySelectorAll<HTMLElement>('[role="menuitem"]');
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.className, `Menu item "${label(item)}"`).toMatch(/py-|h-|min-h/);
      }
    });
  });

  describe('LanguageSelector', () => {
    it('compact trigger has min-h-11', () => {
      const { container } = render(
        <LanguageSelector currentLocale="en" onLocaleChange={vi.fn()} compact />,
      );
      const btns = getInteractiveElements(container);
      expect(btns.length).toBeGreaterThan(0);
      for (const b of btns) {
        expect(b.className, `LanguageSelector "${label(b)}"`).toMatch(/min-h-11/);
      }
    });

    it('full trigger has min-h-11', () => {
      const { container } = render(
        <LanguageSelector currentLocale="en" onLocaleChange={vi.fn()} />,
      );
      const btns = getInteractiveElements(container);
      expect(btns.length).toBeGreaterThan(0);
      for (const b of btns) {
        expect(b.className, `LanguageSelector "${label(b)}"`).toMatch(/min-h-11/);
      }
    });

    it('dropdown menu items have py-2.5 (≥44px height)', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <LanguageSelector currentLocale="en" onLocaleChange={vi.fn()} />,
      );
      await user.click(screen.getByRole('button', { name: /select language/i }));
      const items = container.querySelectorAll<HTMLElement>('[role="menuitemradio"]');
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.className, `Language item "${label(item)}"`).toMatch(/py-2\.5|py-3|min-h/);
      }
    });
  });

  describe('Combined audit', () => {
    it('all interactive elements in LanguageSelector + DarkModeToggle have WCAG-compliant classes', () => {
      const { container } = render(
        <div style={{ width: 375 }}>
          <LanguageSelector currentLocale="en" onLocaleChange={vi.fn()} compact />
          <DarkModeToggle />
        </div>,
      );

      const elements = getInteractiveElements(container);
      expect(elements.length).toBeGreaterThan(0);

      const failures: string[] = [];
      for (const el of elements) {
        const cls = el.className;
        const hasHeight =
          /h-1[012]/.test(cls) ||
          /min-h-1[012]/.test(cls) ||
          /flex-1/.test(cls) ||
          /w-full/.test(cls);
        if (!hasHeight) {
          failures.push(`"${label(el)}" — classes: ${cls.slice(0, 80)}`);
        }
      }

      expect(
        failures.length,
        `Elements missing WCAG 44px height classes:\n  ${failures.join('\n  ')}`,
      ).toBe(0);
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../app-shell';
import { useAuthStore } from '@/stores/auth-store';
import { UserRole } from '@jeevandata/shared-types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/ui/brand', () => ({
  Brand: ({ compact }: { compact?: boolean }) => (
    <div data-testid="brand" data-compact={compact ?? false}>
      Brand
    </div>
  ),
}));

vi.mock('@/components/ui/dark-mode-toggle', () => ({
  DarkModeToggle: () => <div data-testid="dark-mode-toggle">DarkMode</div>,
}));

vi.mock('@/services/api', () => ({
  authApi: { logout: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}));

const testUser = {
  id: 'u1',
  email: 'doctor@jeevandata.com',
  name: 'Dr. Test User',
  role: UserRole.DOCTOR,
  clinicId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.getState().clearSession();
  localStorage.clear();
});

describe('AppShell - mobile hamburger sidebar', () => {
  it('renders hamburger button with md:hidden class', () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, testUser);
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    const hamburger = screen.getByRole('button', { name: /open navigation menu/i });
    expect(hamburger).toBeInTheDocument();
    expect(hamburger.className).toContain('md:hidden');
  });

  it('mobile sidebar is hidden by default', () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, testUser);
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    expect(screen.queryByRole('dialog', { name: /navigation menu/i })).not.toBeInTheDocument();
  });

  it('clicking hamburger opens the mobile sidebar', async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, testUser);
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    await user.click(screen.getByRole('button', { name: /open navigation menu/i }));
    expect(screen.getByRole('dialog', { name: /navigation menu/i })).toBeInTheDocument();
  });

  it('mobile sidebar shows navigation links', async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, testUser);
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    await user.click(screen.getByRole('button', { name: /open navigation menu/i }));
    const sidebar = screen.getByRole('dialog', { name: /navigation menu/i });
    expect(sidebar.querySelector('button[aria-label="Close navigation menu"]')).toBeInTheDocument();
    const links = sidebar.querySelectorAll('a[href="/dashboard"]');
    expect(links.length).toBeGreaterThanOrEqual(1);
  });

  it('clicking close button (X) closes the sidebar', async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, testUser);
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    await user.click(screen.getByRole('button', { name: /open navigation menu/i }));
    expect(screen.getByRole('dialog', { name: /navigation menu/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /close navigation menu/i }));
    expect(screen.queryByRole('dialog', { name: /navigation menu/i })).not.toBeInTheDocument();
  });

  it('clicking backdrop closes the sidebar', async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, testUser);
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    await user.click(screen.getByRole('button', { name: /open navigation menu/i }));
    expect(screen.getByRole('dialog', { name: /navigation menu/i })).toBeInTheDocument();
    const backdrop = document.querySelector('.fixed.inset-0.z-40');
    expect(backdrop).toBeInTheDocument();
    await user.click(backdrop!);
    expect(screen.queryByRole('dialog', { name: /navigation menu/i })).not.toBeInTheDocument();
  });

  it('Escape key closes the sidebar', async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, testUser);
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    await user.click(screen.getByRole('button', { name: /open navigation menu/i }));
    expect(screen.getByRole('dialog', { name: /navigation menu/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /navigation menu/i })).not.toBeInTheDocument();
  });

  it('mobile sidebar shows admin nav links for ADMIN users', async () => {
    const user = userEvent.setup();
    useAuthStore
      .getState()
      .setSession({ accessToken: 'a', refreshToken: 'r' }, { ...testUser, role: UserRole.ADMIN });
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    await user.click(screen.getByRole('button', { name: /open navigation menu/i }));
    const sidebar = screen.getByRole('dialog', { name: /navigation menu/i });
    const linkTexts = Array.from(sidebar.querySelectorAll('a')).map((l) => l.textContent);
    expect(linkTexts).toContain('Dashboard');
    expect(linkTexts).toContain('Analytics');
    expect(linkTexts).toContain('Audit Log');
    expect(linkTexts).toContain('Health');
  });

  it('desktop sidebar renders with md:flex class', () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, testUser);
    const { container } = render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    const desktopSidebar = container.querySelector('aside.hidden');
    expect(desktopSidebar).toBeInTheDocument();
    expect(desktopSidebar!.className).toContain('md:flex');
  });

  it('hamburger button has 44x44 touch target', () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, testUser);
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    const hamburger = screen.getByRole('button', { name: /open navigation menu/i });
    expect(hamburger.className).toContain('h-11');
    expect(hamburger.className).toContain('w-11');
  });

  it('close button has 44x44 touch target', async () => {
    const user = userEvent.setup();
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, testUser);
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>,
    );
    await user.click(screen.getByRole('button', { name: /open navigation menu/i }));
    const closeBtn = screen.getByRole('button', { name: /close navigation menu/i });
    expect(closeBtn.className).toContain('h-11');
    expect(closeBtn.className).toContain('w-11');
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UserRole } from '@jeevandata/shared-types';
import { RequireAuth } from '../require-auth';
import { useAuthStore } from '@/stores/auth-store';

const { replaceMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: replaceMock,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}));

const doctorUser = {
  id: 'u1',
  email: 'doctor@jeevandata.com',
  name: 'Dr. Priya Sharma',
  role: UserRole.DOCTOR,
  clinicId: null,
};

const receptionistUser = {
  id: 'u2',
  email: 'reception@jeevandata.com',
  name: 'Sita Verma',
  role: UserRole.RECEPTIONIST,
  clinicId: null,
};

function hydrateStore() {
  // Mirrors persist's onRehydrateStorage — the flag RequireAuth waits for.
  useAuthStore.getState().setHasHydrated(true);
}

beforeEach(() => {
  vi.clearAllMocks();
  replaceMock.mockClear();
  useAuthStore.getState().clearSession();
  useAuthStore.getState().setHasHydrated(false);
  localStorage.clear();
});

describe('RequireAuth', () => {
  it('renders children when authenticated', () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, doctorUser);
    hydrateStore();

    render(
      <RequireAuth>
        <h1>Secret dashboard</h1>
      </RequireAuth>,
    );

    expect(screen.getByRole('heading', { name: /secret dashboard/i })).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('redirects to /login when unauthenticated', async () => {
    hydrateStore();
    render(
      <RequireAuth>
        <h1>Secret dashboard</h1>
      </RequireAuth>,
    );

    // Loading placeholder while unauthenticated
    expect(screen.getByRole('status', { name: /checking session/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
    expect(screen.queryByRole('heading', { name: /secret dashboard/i })).not.toBeInTheDocument();
  });

  it('redirects to the custom redirectTo when unauthenticated', async () => {
    hydrateStore();
    render(
      <RequireAuth redirectTo="/signin">
        <h1>Secret dashboard</h1>
      </RequireAuth>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/signin');
    });
  });

  it('renders children again once a session is established', async () => {
    const { rerender } = render(
      <RequireAuth>
        <h1>Secret dashboard</h1>
      </RequireAuth>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();

    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, doctorUser);
    hydrateStore();

    rerender(
      <RequireAuth>
        <h1>Secret dashboard</h1>
      </RequireAuth>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /secret dashboard/i })).toBeInTheDocument();
    });
  });
});

describe('RequireAuth — role-based access control', () => {
  it('renders children when the user role is in allowedRoles', () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, doctorUser);
    hydrateStore();

    render(
      <RequireAuth allowedRoles={[UserRole.DOCTOR, UserRole.RECEPTIONIST]}>
        <h1>Doctor panel</h1>
      </RequireAuth>,
    );

    expect(screen.getByRole('heading', { name: /doctor panel/i })).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('shows the access-denied view when the role is not allowed', () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, receptionistUser);
    hydrateStore();

    render(
      <RequireAuth allowedRoles={[UserRole.DOCTOR]}>
        <h1>Doctor panel</h1>
      </RequireAuth>,
    );

    expect(screen.getByRole('alert', { name: /access denied/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /doctor panel/i })).not.toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('keeps the session intact and shows the denied view (no forced logout)', () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, receptionistUser);
    hydrateStore();

    render(
      <RequireAuth allowedRoles={[UserRole.DOCTOR]}>
        <h1>Doctor panel</h1>
      </RequireAuth>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('redirects to deniedRedirectTo when a denied role is provided one', async () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, receptionistUser);
    hydrateStore();

    render(
      <RequireAuth allowedRoles={[UserRole.DOCTOR]} deniedRedirectTo="/dashboard">
        <h1>Doctor panel</h1>
      </RequireAuth>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('treats missing allowedRoles as allow-any-authenticated', () => {
    useAuthStore.getState().setSession({ accessToken: 'a', refreshToken: 'r' }, receptionistUser);
    hydrateStore();

    render(
      <RequireAuth>
        <h1>Any staff area</h1>
      </RequireAuth>,
    );

    expect(screen.getByRole('heading', { name: /any staff area/i })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('RequireAuth — session hydration guard', () => {
  // Regression: refreshing /admin/health (or any protected page) used to
  // bounce through /login → /dashboard because the redirect effect fired
  // during the SSR→client hydration window when the store briefly reads as
  // unauthenticated even though a persisted session exists.
  it('does NOT redirect while the persisted session is still hydrating (even when one exists)', () => {
    // Simulate a real refresh: localStorage has a session, but the store has
    // not rehydrated yet (_hasHydrated === false).
    localStorage.setItem(
      'jeevandata-auth',
      JSON.stringify({
        state: {
          accessToken: 'a',
          refreshToken: 'r',
          user: doctorUser,
          isAuthenticated: true,
        },
        version: 0,
      }),
    );

    render(
      <RequireAuth allowedRoles={[UserRole.ADMIN, UserRole.SYSTEM]}>
        <h1>Admin panel</h1>
      </RequireAuth>,
    );

    // Loading placeholder — no redirect to /login
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('heading', { name: /admin panel/i })).not.toBeInTheDocument();
  });

  it('renders the protected page once hydration completes with a valid session', async () => {
    localStorage.setItem(
      'jeevandata-auth',
      JSON.stringify({
        state: {
          accessToken: 'a',
          refreshToken: 'r',
          user: { ...doctorUser, role: UserRole.ADMIN },
          isAuthenticated: true,
        },
        version: 0,
      }),
    );

    const { rerender } = render(
      <RequireAuth allowedRoles={[UserRole.ADMIN, UserRole.SYSTEM]}>
        <h1>Admin panel</h1>
      </RequireAuth>,
    );

    // Store flips to hydrated + authenticated (as persist's rehydration does)
    useAuthStore.setState({
      isAuthenticated: true,
      user: { ...doctorUser, role: UserRole.ADMIN },
      _hasHydrated: true,
    });
    rerender(
      <RequireAuth allowedRoles={[UserRole.ADMIN, UserRole.SYSTEM]}>
        <h1>Admin panel</h1>
      </RequireAuth>,
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /admin panel/i })).toBeInTheDocument();
    });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('still redirects unauthenticated users to /login after hydration', async () => {
    useAuthStore.getState().setHasHydrated(true);

    render(
      <RequireAuth>
        <h1>Secret dashboard</h1>
      </RequireAuth>,
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/login');
    });
  });
});
